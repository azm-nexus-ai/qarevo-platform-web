"use client";

import Calender from "../../public/icons/calenderIcon";
import Clock from "../../public/icons/clockIcon";
import Image from "next/image";
import type { Appointment } from "../../components/types/Appointment";

type AppointmentCardProps = {
  appointment: Appointment;
  active: boolean;
  onClick: () => void;
};

export default function AppointmentCard({
  appointment,
  active,
  onClick,
}: AppointmentCardProps) {
  return (
    <div
      onClick={onClick}
      className={`border-2 rounded-xl shadow-sm cursor-pointer ${
        active ? "border-[#074360]" : "border-[#1A9AC0]"
      }`}
    >
      <div
        className={`flex gap-4 items-center p-3 rounded-t-lg text-white text-sm transition-colors duration-300 ${
          active ? "bg-[#074360]" : "bg-[#1A9AC0]"
        }`}
      >
        <div className="flex items-center gap-2">
          <Calender className="text-white" />
          <p>{appointment.date}</p>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="text-white" />
          <p>{appointment.time}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4 px-3">
        <Image
          src={appointment.profilePic}
          alt={appointment.doctor}
          width={45}
          height={45}
        />

        <div>
          <h3 className="font-semibold text-[#022838]">
            {appointment.doctor}
          </h3>

          <p className="text-sm text-[#022838]">
            {appointment.department}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 text-sm font-semibold border-t border-t-[#07436080] text-[#022838] p-3">
        <Image
          src={appointment.icon}
          alt="patient"
          width={20}
          height={20}
        />

        <span>{appointment.patient}</span>
      </div>
    </div>
  );
}