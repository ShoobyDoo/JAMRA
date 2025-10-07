"use client";

import { useEffect } from "react";
import { testLogging } from "@/lib/logger-test";

export default function TestLoggingPage() {
  useEffect(() => {
    // Run the logging test when the component mounts
    testLogging();
  }, []);

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">JAMRA Logging System Test</h1>

        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">Logging Test Results</h2>
          <p className="text-muted-foreground mb-4">
            The logging test has been executed. Check the browser console (F12) to see the logging output.
          </p>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded">
              <h3 className="font-medium">What to expect in the console:</h3>
              <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground">
                <li>Debug, Info, Warning, and Error messages with timestamps</li>
                <li>Network request/response logging with timing information</li>
                <li>Component lifecycle logging</li>
                <li>User action and performance logging</li>
                <li>Log level configuration tests</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded">
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Features Demonstrated:</h3>
              <ul className="list-disc list-inside mt-2 text-sm text-blue-800 dark:text-blue-200">
                <li>✅ Development-only verbose logging</li>
                <li>✅ Network request/response tracking</li>
                <li>✅ Component lifecycle monitoring</li>
                <li>✅ Performance measurement</li>
                <li>✅ Configurable log levels</li>
                <li>✅ Structured logging with context</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-green-50 dark:bg-green-950 rounded">
            <h3 className="font-medium text-green-900 dark:text-green-100">Next Steps:</h3>
            <p className="text-sm text-green-800 dark:text-green-200 mt-2">
              The logging system is now active throughout the application. You can:
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-green-800 dark:text-green-200">
              <li>Monitor network requests in real-time</li>
              <li>Track component mounting/unmounting</li>
              <li>Debug user interactions and performance issues</li>
              <li>Adjust log levels as needed for different environments</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
