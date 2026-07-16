"use client";

import Image from "next/image";

import user from "../../public/icons/user.svg";
import plus from "../../public/icons/plus.svg";

export default function PatientInformation() {
  return (
    <div className="flex flex-col gap-2 border-b border-[#C2D5DF] py-5">

      <h3 className="font-bold text-[#074360]">
        Patient Information
      </h3>

      <div className="flex justify-between">

        <div className="flex gap-4 items-center">

          <div className="bg-[#B2DDFF] p-3 rounded-lg">
            <Image src={user} alt="user" />
          </div>

          <h3 className="text-[#101828] font-medium">
            John Anderson
          </h3>

        </div>

        <button className="flex gap-2 px-4 py-2 border border-[#94B5C7] cursor-pointer rounded-lg shadow-sm">

          <Image
            src={plus}
            alt="plus"
          />

          Add participants

        </button>

      </div>

    </div>
  );
}