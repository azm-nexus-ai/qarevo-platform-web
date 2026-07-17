"use client";

import Image from "next/image";

export default function DoctorCard({ doctor }) {
  return (
    <div className="bg-[#F7FAFC] px-4 py-2 md:mt-10 mt-3 border border-[#C2D5DF] rounded-lg shadow-sm">
      <div className="flex items-center gap-3">
        <Image
          src={doctor.profilePic}
          alt={doctor.doctor}
          width={60}
          height={60}
        />

        <div>
          <h3 className="font-bold text-lg text-[#1A365D]">
            {doctor.doctor}
          </h3>

          <p className="text-[#022838]">
            {doctor.department}
          </p>
        </div>
      </div>
    </div>
  );
}