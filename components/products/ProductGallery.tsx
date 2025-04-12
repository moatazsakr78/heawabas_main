'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductGalleryProps {
  images: string[];
}

export default function ProductGallery({ images }: ProductGalleryProps) {
  const [mainImage, setMainImage] = useState(images[0]);

  return (
    <div className="space-y-4">
      {/* Main image */}
      <div className="relative rounded-lg overflow-hidden h-96 bg-gray-100">
        <Image
          src={mainImage}
          alt="Product image"
          fill
          className="object-contain"
          priority
        />
      </div>
      
      {/* Thumbnails */}
      <div className="flex space-x-2 rtl:space-x-reverse overflow-x-auto pb-2">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => setMainImage(image)}
            className={`relative w-20 h-20 rounded-md overflow-hidden flex-shrink-0 ${
              mainImage === image ? 'ring-2 ring-primary' : 'ring-1 ring-gray-200'
            }`}
          >
            <Image
              src={image}
              alt={`Product image ${index + 1}`}
              fill
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
} 