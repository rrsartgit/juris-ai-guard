import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EncryptionResult {
  encryptedData: Uint8Array;
  iv: string;
  authTag: string;
}

class KMSService {
  private masterKey: string;

  constructor() {
    // In production, this would be retrieved from a secure KMS
    this.masterKey = Deno.env.get('MASTER_ENCRYPTION_KEY') || 'default-key-for-dev';
  }

  async generateDEK(): Promise<string> {
    // Generate a 256-bit (32 bytes) Data Encryption Key
    const dek = new Uint8Array(32);
    crypto.getRandomValues(dek);
    return this.uint8ArrayToHex(dek);
  }

  async encryptDEK(dek: string): Promise<string> {
    // In production, this would use AWS KMS, HashiCorp Vault, etc.
    // For demo, we'll use a simple symmetric encryption with the master key
    const encoder = new TextEncoder();
    const dekBytes = encoder.encode(dek);
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.masterKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dekBytes
    );

    return JSON.stringify({
      encrypted: this.uint8ArrayToHex(new Uint8Array(encrypted)),
      iv: this.uint8ArrayToHex(iv)
    });
  }

  async decryptDEK(encryptedDEK: string): Promise<string> {
    const { encrypted, iv } = JSON.parse(encryptedDEK);
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.masterKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.hexToUint8Array(iv) },
      key,
      this.hexToUint8Array(encrypted)
    );

    return decoder.decode(decrypted);
  }

  async encryptFile(data: Uint8Array, dek: string): Promise<EncryptionResult> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      this.hexToUint8Array(dek),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const encryptedArray = new Uint8Array(encrypted);
    const authTag = encryptedArray.slice(-16); // Last 16 bytes are the auth tag
    const ciphertext = encryptedArray.slice(0, -16);

    return {
      encryptedData: ciphertext,
      iv: this.uint8ArrayToHex(iv),
      authTag: this.uint8ArrayToHex(authTag)
    };
  }

  private uint8ArrayToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { documentId } = await req.json()

    if (!documentId) {
      throw new Error('Document ID is required')
    }

    // Initialize KMS service
    const kms = new KMSService();

    // Get document from queue
    const { data: queueItem, error: queueError } = await supabaseClient
      .from('processing_queue')
      .select('*')
      .eq('document_id', documentId)
      .eq('status', 'pending')
      .single()

    if (queueError) {
      throw new Error(`Queue item not found: ${queueError.message}`)
    }

    // Update status to processing
    await supabaseClient
      .from('processing_queue')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', queueItem.id)

    // Get document metadata
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError) {
      throw new Error(`Document not found: ${docError.message}`)
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('documents')
      .download(document.file_path)

    if (downloadError) {
      throw new Error(`File download failed: ${downloadError.message}`)
    }

    // Convert blob to Uint8Array
    const arrayBuffer = await fileData.arrayBuffer()
    const fileBytes = new Uint8Array(arrayBuffer)

    // Generate and encrypt DEK
    const dek = await kms.generateDEK()
    const encryptedDEK = await kms.encryptDEK(dek)

    // Create encryption key record
    const keyId = `key_${documentId}_${Date.now()}`
    const { data: encryptionKey, error: keyError } = await supabaseClient
      .from('encryption_keys')
      .insert({
        key_id: keyId,
        encrypted_dek: encryptedDEK,
        created_by: queueItem.user_id
      })
      .select()
      .single()

    if (keyError) {
      throw new Error(`Failed to create encryption key: ${keyError.message}`)
    }

    // Encrypt file
    const encryptionResult = await kms.encryptFile(fileBytes, dek)

    // Generate encrypted file path
    const encryptedPath = `encrypted/${documentId}_${Date.now()}.enc`

    // Upload encrypted file
    const { error: uploadError } = await supabaseClient
      .storage
      .from('encrypted-documents')
      .upload(encryptedPath, encryptionResult.encryptedData, {
        contentType: 'application/octet-stream'
      })

    if (uploadError) {
      throw new Error(`Encrypted file upload failed: ${uploadError.message}`)
    }

    // Store encryption metadata
    const { error: encryptionMetaError } = await supabaseClient
      .from('document_encryption')
      .insert({
        document_id: documentId,
        encryption_key_id: encryptionKey.id,
        encrypted_path: encryptedPath,
        iv: encryptionResult.iv,
        auth_tag: encryptionResult.authTag
      })

    if (encryptionMetaError) {
      throw new Error(`Failed to store encryption metadata: ${encryptionMetaError.message}`)
    }

    // Update document status
    await supabaseClient
      .from('documents')
      .update({ 
        status: 'encrypted',
        processed_at: new Date().toISOString()
      })
      .eq('id', documentId)

    // Mark processing as completed
    await supabaseClient
      .from('processing_queue')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', queueItem.id)

    // Clear sensitive data from memory
    fileBytes.fill(0)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Document encrypted successfully',
        encryptedPath,
        keyId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Document processing error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})