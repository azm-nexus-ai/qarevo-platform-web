"use client";

import Image from "next/image";
import { ChevronLeft } from "lucide-react";

import Calender from "../../public/icons/calenderIcon";
import Clock from "../../public/icons/clockIcon";

import icon1 from "../../public/icons/icon1.svg";
import icon2 from "../../public/icons/icon2.svg";

import DoctorCard from "./DoctorCard";
import ActionButtons from "./ActionButtons";
import InfoRow from "./InfoRow";
import ConsultationSection from "./ConsultationSection";
import PatientInformation from "./PatientInformation";
import HealthcareFacility from "./HealthcareFacility";

import document from "../../public/icons/document.svg";
import calenderIcon from "../../public/icons/calender2.svg";

import type { Appointment } from "../../components/types/Appointment";

type AppointmentDetailsProps = {
  appointment: Appointment;
  onBack: () => void;
};

export default function AppointmentDetails({
  appointment,
  onBack,
}: AppointmentDetailsProps) {
  return (
    <div className="flex flex-col md:w-175 mt-16 lg:my-5 md:ml-4 border bg-white border-[#E6EEF2] rounded-lg">
      <div className="bg-[#074360] flex justify-between px-5 py-3 rounded-t-lg items-center">
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="lg:hidden flex text-white items-center gap-2"
          >
            <ChevronLeft size={25} />
          </button>

          <h1 className="font-bold text-white text-lg">
            Appointment Details
          </h1>
        </div>

        <div className="flex items-center">
          <Image
            src={icon1}
            alt="Decoration"
            width={50}
            height={50}
          />

          <Image
            src={icon2}
            alt="Decoration"
            width={100}
            height={100}
          />
        </div>
      </div>

      <div className="bg-[#E6EEF2] px-5 py-3 flex gap-3">
        <div className="flex items-center gap-2 text-[#074360]">
          <Calender className="text-[#074360]" />
          <p>{appointment.date}</p>
        </div>

        <div className="flex items-center gap-2 text-[#074360]">
          <Clock className="text-[#074360]" />
          <p>{appointment.time}</p>
        </div>
      </div>

      <div className="md:px-10 px-3">
        <DoctorCard doctor={appointment} />

        <ActionButtons />

        <InfoRow
          icon={document}
          title="Send documents"
          description="Share your previous medical history, including any diagnoses or additional details if available."
        />

        <InfoRow
          icon={calenderIcon}
          title="Add to my calendar"
        />

        <ConsultationSection />

        <PatientInformation />

        <HealthcareFacility />
      </div>
    </div>
  );
}