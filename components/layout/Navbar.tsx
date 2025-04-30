'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FiMenu, FiX, FiHome, FiKey } from 'react-icons/fi';
import AdminLoginModal from '@/components/admin/AdminLoginModal';

const navigation = [
  { name: 'الرئيسية', href: '/', icon: FiHome },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="bg-[#2A2A2A] shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center h-20">
              <Link href="/" className="flex items-center">
                <Image
                  src="/images/hea.png"
                  alt="سنتر هي و بس"
                  width={180}
                  height={80}
                  className="h-20 w-auto max-h-20"
                  priority
                />
              </Link>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between flex-1 mr-10">
            <div className="flex space-x-8 rtl:space-x-reverse">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                      isActive
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-primary hover:text-primary-dark hover:border-b-2 hover:border-primary'
                    }`}
                  >
                    <item.icon className="ml-2 text-primary" />
                    {item.name}
                  </Link>
                );
              })}
              <button 
                onClick={() => setIsAdminModalOpen(true)}
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-primary hover:text-primary-dark hover:border-b-2 hover:border-primary"
              >
                <FiKey className="ml-2 text-primary" />
                سنتر هي و بس
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <FiX className="block h-6 w-6 text-primary" /> : <FiMenu className="block h-6 w-6 text-primary" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden ${isOpen ? 'block' : 'hidden'}`}>
        <div className="px-2 pt-2 pb-3 space-y-1 bg-white shadow-lg rounded-b-lg">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-primary hover:bg-primary/10'
                }`}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className="ml-2 text-primary" />
                {item.name}
              </Link>
            );
          })}

          <button 
            onClick={() => {
              setIsAdminModalOpen(true);
              setIsOpen(false);
            }}
            className="block w-full text-right px-3 py-2 rounded-md text-base font-medium flex items-center text-primary hover:bg-primary/10"
          >
            <FiKey className="ml-2 text-primary" />
            سنتر هي و بس
          </button>
        </div>
      </div>

      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
    </nav>
  );
} 