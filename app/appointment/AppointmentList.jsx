"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import AppointmentCard from "./AppointmentCard";

export default function AppointmentList({
  appointments,
  collapsed,
  selectedAppointment,
  onSelectAppointment,
}) {
  return (
    <div
      className={`bg-white w-90 my-5 p-3 rounded-lg transition-all duration-200 ${
        collapsed ? "ml-[72px]" : "ml-64"
      }`}
    >
      <h1 className="text-[#074360] font-bold">
        My next appointments
      </h1>

      <div className="flex flex-col gap-4 mt-4">
        {appointments.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            active={selectedAppointment.id === appointment.id}
            onClick={() => onSelectAppointment(appointment)}
          />
        ))}
      </div>

      <div className="bg-[#F7FAFC] flex justify-between px-3 items-center mt-10 rounded-lg">
        <p className="font-semibold text-[#074360]">
          Past Appointments
        </p>

        <div className="flex flex-col">
          <button className="cursor-pointer">
            <ChevronUp />
          </button>

          <button className="cursor-pointer">
            <ChevronDown />
          </button>
        </div>
      </div>
    </div>
  );
}