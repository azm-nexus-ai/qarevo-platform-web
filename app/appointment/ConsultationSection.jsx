"use client";

import Image from "next/image";

import consultation from "../../public/icons/consultationLogo.svg";
import location from "../../public/icons/location.svg";
import video from "../../public/icons/videoLogo.svg";

export default function ConsultationSection() {
  return (
    <div className="flex flex-col gap-2 border-b border-[#C2D5DF] py-5">
      <h3 className="font-bold text-[#074360]">
        Consultation details
      </h3>

      <div className="flex gap-4">

        <div className="flex gap-4 items-center">
          <div className="bg-[#B2DDFF] p-3 rounded-lg">
            <Image src={consultation} alt="consultation" />
          </div>

          <h3 className="text-[#101828] font-medium">
            General consultation
          </h3>
        </div>

        <div className="flex gap-4">

          <div className="bg-[#B2DDFF] p-3 rounded-lg">
            <Image src={location} alt="location" />
          </div>

          <div className="border bg-[#ABEFC61A] border-[#0F7A48] rounded-lg flex gap-1 items-center p-2">
            <Image src={video} alt="video" />

            <p className="text-[#0F7A48]">
              Online session
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}