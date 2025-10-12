'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

export default function GmailSetupPage() {
  const [isChecking, setIsChecking] = useState(false);
  const [authStatus, setAuthStatus] = useState<'unknown' | 'authenticated' | 'not_authenticated'>('unknown');
  const [statusMessage, setStatusMessage] = useState('');

  const checkAuthStatus = async () => {
    setIsChecking(true);
    try {
      const response = await fetch('/api/gmail/status');
      const data = await response.json();
      
      if (data.authenticated) {
        setAuthStatus('authenticated');
        setStatusMessage(`Gmail connected for ${data.email}`);
      } else {
        setAuthStatus('not_authenticated');
        setStatusMessage('Gmail not connected');
      }
    } catch (error) {
      setAuthStatus('not_authenticated');
      setStatusMessage('Error checking status');
    } finally {
      setIsChecking(false);
    }
  };

  const initiateAuth = () => {
    // Redirect to the OAuth flow
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gmail Integration Setup
          </h1>
          <p className="text-gray-600">
            Connect your Gmail account to enable email import functionality
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="mr-2 h-5 w-5" />
              Gmail OAuth Configuration
            </CardTitle>
            <CardDescription>
              This will allow CorePragya to read emails sent to wiisecache@gmail.com
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">What this enables:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Read emails sent to wiisecache@gmail.com</li>
                <li>• Extract URLs from emails sent by registered users</li>
                <li>• Process and summarize web content from those URLs</li>
                <li>• Add processed content to your knowledge base</li>
                <li>• Mark processed emails as read</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={checkAuthStatus} 
                disabled={isChecking}
                variant="outline"
                className="w-full"
              >
                {isChecking ? 'Checking...' : 'Check Current Status'}
              </Button>

              {authStatus !== 'unknown' && (
                <Alert className={authStatus === 'authenticated' ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
                  <div className="flex items-center">
                    {authStatus === 'authenticated' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <AlertDescription className="ml-2">
                      {statusMessage}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {authStatus === 'not_authenticated' && (
                <Button 
                  onClick={initiateAuth}
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect Gmail Account
                </Button>
              )}

              {authStatus === 'authenticated' && (
                <div className="text-center">
                  <p className="text-green-600 font-medium">✅ Gmail is connected and ready!</p>
                  <Button 
                    onClick={() => window.location.href = '/knowledge-base'}
                    className="mt-3"
                  >
                    Go to Knowledge Base
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">1</div>
                <div>
                  <strong>Send emails to wiisecache@gmail.com</strong> with URLs you want to save
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">2</div>
                <div>
                  <strong>Click "Refresh from Email"</strong> in the knowledge base
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">3</div>
                <div>
                  <strong>System processes URLs</strong> and adds summaries to your knowledge base
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
