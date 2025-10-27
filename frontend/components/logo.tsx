import Image from 'next/image';

export default function Logo({
  className = '',
  width,          // optional explicit px
  height,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  /*  if caller gives exact px → use them
   *  otherwise let CSS (w-*, h-*, or tailwind) control size  */
  const img = (
    <Image
      src="/images/lana-logo-transparent.png"
      alt="LANA AI"
      width={width ?? 256} 
      height={height ?? 96}
      className={`max-w-full h-auto ${className}`}
      priority
    />
  );

  return width && height ? img : <div className="inline-block">{img}</div>;
}