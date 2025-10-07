/**
 * Test script for the logging utility
 * Run this in development to verify logging functionality
 */

import { logger, LogLevel } from './logger';

// Test the logging functionality
export function testLogging(): void {
  console.log('=== JAMRA Logger Test ===');

  // Test different log levels
  logger.debug('This is a debug message', {
    component: 'LoggerTest',
    action: 'test-debug',
    testData: { key: 'value' }
  });

  logger.info('This is an info message', {
    component: 'LoggerTest',
    action: 'test-info',
    userId: 'test-user-123'
  });

  logger.warn('This is a warning message', {
    component: 'LoggerTest',
    action: 'test-warn',
    warningCode: 'TEST_WARNING'
  });

  logger.error('This is an error message', {
    component: 'LoggerTest',
    action: 'test-error',
    errorCode: 'TEST_ERROR',
    stackTrace: 'Error stack would go here'
  });

  // Test network logging
  logger.networkRequest('https://api.example.com/test', 'GET', {
    component: 'LoggerTest',
    action: 'test-network-request',
    requestSize: 256
  });

  logger.networkResponse('https://api.example.com/test', 'GET', 200, 150, {
    component: 'LoggerTest',
    action: 'test-network-response',
    responseSize: 1024
  });

  // Test API logging
  logger.apiCall('/api/test-endpoint', 'POST', {
    component: 'LoggerTest',
    action: 'test-api-call'
  });

  logger.apiResponse('/api/test-endpoint', 'POST', 201, 75, {
    component: 'LoggerTest',
    action: 'test-api-response'
  });

  // Test component logging
  logger.componentMount('TestComponent', {
    component: 'LoggerTest',
    action: 'test-component-mount'
  });

  logger.componentUnmount('TestComponent', {
    component: 'LoggerTest',
    action: 'test-component-unmount'
  });

  // Test user action logging
  logger.userAction('button-click', {
    buttonId: 'test-button',
    page: '/test-page'
  }, {
    component: 'LoggerTest',
    action: 'test-user-action'
  });

  // Test performance logging
  logger.performance('test-operation', 42, {
    component: 'LoggerTest',
    action: 'test-performance'
  });

  // Test configuration methods
  console.log(`Current log level: ${logger.getCurrentLogLevel()}`);
  console.log(`Verbose logging enabled: ${logger.isVerboseLoggingEnabled()}`);

  // Test log level changes
  logger.setMinLevel(LogLevel.WARN);
  console.log(`Changed log level to WARN. Current level: ${logger.getCurrentLogLevel()}`);

  logger.debug('This debug message should not appear (level too low)');
  logger.info('This info message should not appear (level too low)');
  logger.warn('This warning should appear');
  logger.error('This error should appear');

  // Reset to default
  logger.enableVerboseLogging();
  console.log(`Reset to verbose logging. Current level: ${logger.getCurrentLogLevel()}`);

  console.log('=== Logger Test Complete ===');
}

// Export for use in browser console or other contexts
if (typeof window !== 'undefined') {
  (window as any).testLogging = testLogging;
}
