import Image from "next/image";

type AppBrandMarkProps = {
  className?: string;
  priority?: boolean;
};

export default function AppBrandMark({ className = "", priority = false }: AppBrandMarkProps) {
  return (
    <span className={`app-brand-mark ${className}`.trim()}>
      <Image src="/korus_sign_color.jpg" alt="KORUS Consulting" fill sizes="112px" priority={priority} />
    </span>
  );
}
