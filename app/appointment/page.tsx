"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "../../components/patientSidebar";
import MobileBottomNav from "../../components/MobileBottomNav";

import AppointmentList from "./AppointmentList";
import AppointmentDetails from "./AppointmentDetails";

import ProfilePic from "../../public/icons/profilePic.svg";
import userIcon from "../../public/icons/userIcon.svg";

import type { Appointment } from "../../components/types/Appointment";

const APPOINTMENTS: Appointment[] = [
  {
    id: 1,
    date: "Mon, 16.03.26",
    time: "10:00 - 10:30",
    doctor: "Dr. Sarah Wilson",
    department: "Cardiology",
    patient: "Emily Johnson",
    profilePic: ProfilePic,
    icon: userIcon,
  },
  {
    id: 2,
    date: "Mon, 17.03.26",
    time: "10:00 - 10:30",
    doctor: "Dr. Sarah Wilson",
    department: "Physiotherapy",
    patient: "Emily Johnson",
    profilePic: ProfilePic,
    icon: userIcon,
  },
  {
    id: 3,
    date: "Mon, 18.03.26",
    time: "10:00 - 10:30",
    doctor: "Dr. Sarah Wilson",
    department: "Cardiology",
    patient: "Emily Johnson",
    profilePic: ProfilePic,
    icon: userIcon,
  },
];

export default function AppointmentPage() {
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment>(APPOINTMENTS[0]);

  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [activeId, setActiveId] =
    useState<string>("appointments");

  const router = useRouter();

  const handleNavigate = (id: string): void => {
    setActiveId(id);

    switch (id) {
      case "home":
        router.push("/");
        break;

      case "appointments":
        router.push("/appointments");
        break;

      case "messages":
        router.push("/messages");
        break;

      case "myDoctors":
        router.push("/my-doctors");
        break;

      case "records":
        router.push("/medical-records");
        break;

      default:
        break;
    }
  };

  const handleAppointmentClick = (
    appointment: Appointment
  ): void => {
    setSelectedAppointment(appointment);

    if (window.innerWidth < 1024) {
      setShowDetails(true);
    }
  };

  return (
    <div className="bg-[#F7FAFC] md:flex">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        activeId={activeId}
        onNavigate={handleNavigate}
      />

      {/* Appointment Listing */}
      <div
        className={`
          ${showDetails ? "hidden" : "block"}
          lg:block
        `}
      >
        <AppointmentList
          appointments={APPOINTMENTS}
          collapsed={collapsed}
          selectedAppointment={selectedAppointment}
          onSelectAppointment={handleAppointmentClick}
        />
      </div>

      {/* Appointment Details */}
      <div
        className={`
          ${showDetails ? "block" : "hidden"}
          lg:block
        `}
      >
        <AppointmentDetails
          appointment={selectedAppointment}
          onBack={() => setShowDetails(false)}
        />
      </div>

      <MobileBottomNav
        activeId={activeId}
        onNavigate={handleNavigate}
      />
    </div>
  );
}