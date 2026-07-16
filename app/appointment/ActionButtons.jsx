"use client";

import Image from "next/image";

import videoIcon from "../../public/icons/videoIcon.svg";
import copyIcon from "../../public/icons/copyIcon.svg";
import Chat from "../../public/icons/chatIcon.svg";

export default function ActionButtons() {
  return (
    <div className="flex mt-7 gap-5">
      <div className="flex">
        <button className="bg-[#1E70CC] flex gap-3 py-2 cursor-pointer text-white border rounded-r-none rounded-lg px-34 border-[#175CD3] shadow-sm">
          <Image
            src={videoIcon}
            alt="video"
          />

          <h3>Join Call</h3>
        </button>

        <button className="bg-[#1E70CC] rounded-l-none cursor-pointer rounded-lg border-2 border-l-white px-3 py-2 border-[#175CD3] shadow-sm">
          <Image
            src={copyIcon}
            alt="copy"
          />
        </button>
      </div>

      <button className="border border-[#94B5C7] cursor-pointer shadow-sm rounded-lg flex gap-2 py-2 px-15">
        <Image
          src={Chat}
          alt="chat"
        />

        Chat
      </button>
    </div>
  );
}