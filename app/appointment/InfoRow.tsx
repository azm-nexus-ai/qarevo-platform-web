"use client";

import Image, { type StaticImageData } from "next/image";
import { ChevronRight } from "lucide-react";

type InfoRowProps = {
  icon: StaticImageData;
  title: string;
  description?: string;
};

export default function InfoRow({
  icon,
  title,
  description,
}: InfoRowProps) {
  return (
    <div className="flex gap-4 py-5 items-center border-b border-[#C2D5DF]">
      <div className="bg-[#B2DDFF] p-3 rounded-lg">
        <Image
          src={icon}
          alt={title}
          width={24}
          height={24}
        />
      </div>

      <div className="flex-1">
        <h3 className="font-bold text-[#074360]">
          {title}
        </h3>

        {description && (
          <p className="text-sm text-[#022838]">
            {description}
          </p>
        )}
      </div>

      <button className="cursor-pointer">
        <ChevronRight />
      </button>
    </div>
  );
}