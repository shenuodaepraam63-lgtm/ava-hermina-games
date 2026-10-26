/**
 * Only VITE_* variables are available in the browser.
 * Cloudinary secrets must NEVER use the VITE_ prefix.
 */
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  cloudinaryCloudName: (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || '',
}

export function assertEnv() {
  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    console.warn(
      'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
    )
  }
}
