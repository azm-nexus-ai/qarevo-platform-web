"use client";

import Image from "next/image";

import phoneLogo from "../../public/icons/phoneLogo.svg";
import copy from "../../public/icons/copyLogo.svg";
import hospitalLogo from "../../public/icons/hospitalLogo.svg";
import pounds from "../../public/icons/feeLogo.svg";
import cancelLogo from "../../public/icons/cancelLogo.svg";
import timeLogo from "../../public/icons/timeLogo.svg";

export default function HealthcareFacility() {
  return (
    <>
      <div className="flex flex-col py-5 gap-2 border-b border-[#C2D5DF]">

        <h3 className="font-bold text-[#074360]">
          Details of the healthcare facility
        </h3>

        <div className="flex md:flex-row flex-col gap-5 md:gap-25">

          <div className="flex gap-4 items-center">

            <div className="bg-[#B2DDFF] p-3 rounded-lg">
              <Image src={phoneLogo} alt="phone" />
            </div>

            <div>
              <h3 className="font-medium">
                Phone number
              </h3>

              <div className="flex gap-2">
                <p>01234567890</p>

                <button className="cursor-pointer">
                  <Image
                    src={copy}
                    alt="copy"
                  />
                </button>
              </div>

            </div>

          </div>

          <div className="flex gap-4 items-center">

            <div className="bg-[#B2DDFF] p-3 rounded-lg">
              <Image src={hospitalLogo} alt="hospital" />
            </div>

            <h3 className="font-medium">
              Praxis Dr. Sarah Wilson
            </h3>

          </div>

        </div>

      </div>

      <div className="flex py-5 gap-2">

        <div className="flex gap-4 items-center">

          <div className="bg-[#B2DDFF] p-3 rounded-lg">
            <Image src={pounds} alt="fee" />
          </div>

          <div>
            <h3 className="font-medium">
              Fees and reimbursement
            </h3>

            <p className="text-sm">
              Accepts public and private insurance
            </p>

          </div>

        </div>

      </div>

      <div className="flex gap-3 md:justify-between pb-10 pt-2">

        <button className="border border-[#94B5C7] cursor-pointer rounded-lg shadow-sm flex gap-1 md:gap-2 px-2 md:px-20 py-2">

          <Image
            src={timeLogo}
            alt="time"
          />

          Reschedule

        </button>

        <button className="border border-[#DB3E3E] rounded-lg cursor-pointer shadow-sm flex gap-1 md:gap-2 px-2 md:px-18 py-2">

          <Image
            src={cancelLogo}
            alt="cancel"
          />

          Cancel appointment

        </button>

      </div>
    </>
  );
}