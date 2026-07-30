"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import AppointmentCard from "./AppointmentCard";
import type { Appointment } from "../../components/types/Appointment";

type AppointmentListProps = {
  appointments: Appointment[];
  collapsed: boolean;
  selectedAppointment: Appointment;
  onSelectAppointment: (appointment: Appointment) => void;
};

export default function AppointmentList({
  appointments,
  collapsed,
  selectedAppointment,
  onSelectAppointment,
}: AppointmentListProps) {
  return (
    <div
      className={`md:bg-white md:w-90 mt-16.5 md:my-5 md:p-3 rounded-lg transition-all duration-200 ${
        collapsed ? "lg:ml-[72px]" : "lg:ml-64"
      }`}
    >
      <div className="w-full px-2 md:px-0">
        <h1 className="text-[#074360] text-lg font-bold">
          My next appointments
        </h1>

        <div className="border border-[#94B5C7] lg:hidden my-3 flex justify-between rounded-lg pl-10 pr-5 py-2">
          <button className="cursor-pointer">
            <p className="text-[#5E8AA3] text-lg">
              Upcoming
            </p>
          </button>

          <button className="bg-[#074360] text-white rounded-lg px-18 py-2 cursor-pointer">
            <p>Past</p>
          </button>
        </div>

        <div className="flex flex-col gap-4 mt-4">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              active={
                selectedAppointment.id === appointment.id
              }
              onClick={() =>
                onSelectAppointment(appointment)
              }
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
    </div>
  );
}