import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2, Shield, Lock } from "lucide-react";

interface DocumentUploaderProps {
  caseId: string;
  onUploadComplete?: (documentId: string) => void;
}

const DocumentUploader = ({ caseId, onUploadComplete }: DocumentUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setProgress(10);

    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      setProgress(30);
      setProcessingStatus("Uploading file...");

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setProgress(60);
      setProcessingStatus("Creating document record...");

      // Create document record in database
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          case_id: caseId,
          title: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          status: 'uploaded'
        })
        .select()
        .single();

      if (docError) throw docError;

      setProgress(80);
      setProcessingStatus("Queuing for secure processing...");

      // Enqueue document for processing (encryption + AI analysis)
      const { data: queueData, error: queueError } = await supabase
        .rpc('enqueue_document_processing', {
          p_document_id: document.id,
          p_task_type: 'document_analysis',
          p_task_data: {
            encryption_required: true,
            ai_analysis: true,
            embedding_generation: true
          }
        });

      if (queueError) throw queueError;

      setProgress(100);
      setProcessingStatus("Document queued successfully!");

      toast({
        title: "Document uploaded successfully",
        description: "Your document has been securely uploaded and queued for processing.",
      });

      // Listen for processing completion
      const subscription = supabase
        .channel('processing_updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'processing_queue',
            filter: `document_id=eq.${document.id}`
          },
          (payload) => {
            if (payload.new.status === 'completed') {
              toast({
                title: "Document processing completed",
                description: "Your document has been encrypted and analyzed by AI.",
              });
              subscription.unsubscribe();
            } else if (payload.new.status === 'failed') {
              toast({
                title: "Document processing failed",
                description: "There was an error processing your document.",
                variant: "destructive",
              });
              subscription.unsubscribe();
            }
          }
        )
        .subscribe();

      onUploadComplete?.(document.id);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(0);
      setProcessingStatus("");
    }
  }, [caseId, onUploadComplete, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: uploading
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-navy" />
          Secure Document Upload
        </CardTitle>
        <CardDescription>
          Upload legal documents for secure encryption and AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-gold bg-gold/5' : 'border-navy/20 hover:border-navy/40'}
            ${uploading ? 'pointer-events-none opacity-50' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          {uploading ? (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-navy mx-auto" />
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground">{processingStatus}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Upload className="h-12 w-12 text-navy" />
                <Lock className="h-6 w-6 text-gold" />
              </div>
              
              {isDragActive ? (
                <p className="text-lg font-medium text-navy">
                  Drop the document here...
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-medium text-navy">
                    Drop documents here or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports PDF, DOC, DOCX, TXT (max 50MB)
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  AES-256 Encrypted
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  AI Analyzed
                </div>
              </div>
            </div>
          )}
        </div>

        {!uploading && (
          <div className="mt-4 p-4 bg-navy/5 rounded-lg">
            <h4 className="font-medium text-navy mb-2">Security Features:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• End-to-end encryption with envelope encryption</li>
              <li>• Automatic AI analysis and content extraction</li>
              <li>• Secure vector embeddings for document search</li>
              <li>• Real-time processing status updates</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentUploader;