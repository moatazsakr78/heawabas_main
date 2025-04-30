import Link from 'next/link';
import Image from 'next/image';

const footerNavigation = {
  main: [
    { name: 'الرئيسية', href: '/' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-[#5F5F5F] text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="mb-4">
              <Image
                src="/images/hea.png"
                alt="سنتر هي و بس"
                width={200}
                height={70}
                className="h-16 w-auto"
              />
            </div>
            <p className="text-gray-200 mb-4">
              كتالوج شامل لجميع منتجاتنا المميزة بتصنيفات متعددة وتحديثات دورية.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">روابط سريعة</h3>
            <ul className="space-y-2">
              {footerNavigation.main.map((item) => (
                <li key={item.name}>
                  <Link href={item.href} className="text-gray-300 hover:text-white">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-500 mt-12 pt-8">
          <p className="text-center text-gray-300">
            &copy; {new Date().getFullYear()} سنتر هي و بس. جميع الحقوق محفوظة.
          </p>
          <p className="text-center text-gray-300 mt-2">
            Developed by Moataz Sakr
          </p>
        </div>
      </div>
    </footer>
  );
}