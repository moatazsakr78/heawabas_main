'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductGalleryProps {
  imageUrl: string;
}

export default function ProductGallery({ imageUrl }: ProductGalleryProps) {
  return (
    <div className="space-y-4">
      {/* Main image */}
      <div className="relative rounded-lg overflow-hidden h-96 bg-gray-100">
        <Image
          src={imageUrl}
          alt="Product image"
          fill
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
} 