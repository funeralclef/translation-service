// Simple script to test document URL processing
// Run with: node test-document-processing.js

// Sample URLs to test
const testUrls = [
  // Local file paths (should be rejected)
  'file:///test.pdf',
  'D:\\test\\file.pdf',
  '/var/www/file.pdf',
  
  // Supabase storage URLs
  'https://whdlmrjsqxcxfknsspza.supabase.co/storage/v1/object/public/documents/test.pdf',
  'https://whdlmrjsqxcxfknsspza.supabase.co/storage/v1/object/authenticated/documents/test.pdf',
  
  // Other URLs
  'https://example.com/files/document.pdf',
  'https://mydomain.com/documents/file.docx',
  
  // URLs with partial paths that might be confused
  'https://api.example.com/documents/file.txt',
];

// Test file extension extraction
console.log('*** Testing file extension extraction ***');
testUrls.forEach(url => {
  const fileExt = url.split('.').pop()?.split('?')[0]?.toLowerCase();
  console.log(`URL: ${url}`);
  console.log(`File extension: ${fileExt}`);
  console.log(`Supported: ${['pdf', 'docx', 'txt'].includes(fileExt)}`);
  console.log('---');
});

// Test URL type detection
console.log('\n*** Testing URL type detection ***');
testUrls.forEach(url => {
  const isLocal = url.startsWith('file://') || url.startsWith('/') || url.match(/^[A-Za-z]:\\/);
  const isSupabasePublic = url.includes('supabase.co/storage/v1/object/public/');
  const isSupabaseAuth = url.includes('supabase.co/storage/v1/object/authenticated/');
  
  console.log(`URL: ${url}`);
  console.log(`Is local file: ${isLocal}`);
  console.log(`Is Supabase public: ${isSupabasePublic}`);
  console.log(`Is Supabase authenticated: ${isSupabaseAuth}`);
  console.log('---');
});

// Test bucket and path extraction
console.log('\n*** Testing bucket and path extraction ***');
testUrls.forEach(url => {
  const urlParts = url.split('/');
  const bucketIndex = urlParts.findIndex(part => part === 'documents');
  const bucketName = bucketIndex > -1 ? 'documents' : null;
  const filePath = bucketIndex > -1 ? urlParts.slice(bucketIndex + 1).join('/') : null;
  
  console.log(`URL: ${url}`);
  console.log(`Bucket name: ${bucketName}`);
  console.log(`File path: ${filePath}`);
  console.log('---');
});

console.log('\n*** INSTRUCTIONS ***');
console.log('1. Make sure your storage bucket is named "documents"');
console.log('2. Set up appropriate RLS policies for your storage bucket');
console.log('3. Set OPENAI_API_KEY in your .env.local file');
console.log('4. Use signed URLs whenever possible for more secure access');
console.log('5. For debugging, visit /api/analyze-document/test?url=YOUR_URL to test URL handling'); 