/**
 * This script configures the product-images bucket in Supabase Storage
 * with the correct permissions and settings.
 * 
 * Usage: node configure-bucket.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function configureBucket() {
  try {
    console.log('Checking for bucket "product-images"...');
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === 'product-images');
    
    // Create bucket if it doesn't exist
    if (!bucketExists) {
      console.log('Creating bucket "product-images"...');
      const { error: createError } = await supabase.storage.createBucket('product-images', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
        return;
      }
      
      console.log('Bucket created successfully');
    } else {
      console.log('Bucket "product-images" already exists');
    }
    
    // Update bucket configuration
    console.log('Updating bucket configuration...');
    const { error: updateError } = await supabase.storage
      .from('product-images')
      .updateBucket({
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        corsConfigurations: [
          {
            allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedOrigins: ['*'],
            maxAgeSeconds: 31536000
          }
        ]
      });
    
    if (updateError) {
      console.error('Error updating bucket configuration:', updateError);
      return;
    }
    
    console.log('Bucket configuration updated');
    
    // Update bucket policies
    console.log('Setting bucket policies...');
    try {
      const { error: policyError } = await supabase.storage
        .from('product-images')
        .updateBucketPolicy({
          name: 'allow-public-read-authenticated-write',
          definition: {
            statements: [
              {
                effect: 'allow',
                principal: { id: '*' },
                actions: ['select'],
                resources: ['product-images/*']
              },
              {
                effect: 'allow',
                principal: { type: 'authenticated' },
                actions: ['select', 'insert', 'update', 'delete'],
                resources: ['product-images/*']
              }
            ]
          }
        });
      
      if (policyError) {
        console.error('Error updating bucket policy:', policyError);
        
        // Try alternative method to set bucket public
        console.log('Trying alternative method to make bucket public...');
        const { error: publicityError } = await supabase.storage
          .from('product-images')
          .setPublic(true);
        
        if (publicityError) {
          console.error('Error setting bucket public:', publicityError);
        } else {
          console.log('Successfully made bucket public using alternative method');
        }
      } else {
        console.log('Bucket policies updated successfully');
      }
    } catch (error) {
      console.error('Error updating policies:', error);
    }
    
    console.log('Bucket configuration complete');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

configureBucket().catch(console.error); 