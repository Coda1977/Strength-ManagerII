// Fix for Replit host blocking issue
// Set environment variables to allow all hosts in development
if (process.env.NODE_ENV === 'development') {
  process.env.DANGEROUSLY_DISABLE_HOST_CHECK = 'true';
  process.env.VITE_HOST = '0.0.0.0';
  process.env.VITE_PORT = '5000';
  
  console.log('🔧 Host override activated for Replit domains');
}

export {};