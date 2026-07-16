"use client";

import { useState } from "react";
import Sidebar from "../../components/patientSidebar";
import ProfilePic from "../../public/icons/profilePic.svg";
import userIcon from "../../public/icons/userIcon.svg";
import Calender from "../../public/icons/calenderIcon.jsx";
import Clock from "../../public/icons/clockIcon.jsx";
import icon1 from "../../public/icons/icon1.svg";
import icon2 from "../../public/icons/icon2.svg";
import videoIcon from "../../public/icons/videoIcon.svg";
import copyIcon from "../../public/icons/copyIcon.svg";
import Chat from "../../public/icons/chatIcon.svg";
import document from "../../public/icons/document.svg";
import calenderIcon from "../../public/icons/calender2.svg";
import consultation from "../../public/icons/consultationLogo.svg";
import location from "../../public/icons/location.svg";
import video from "../../public/icons/videoLogo.svg";
import user from "../../public/icons/user.svg";
import pounds from "../../public/icons/feeLogo.svg"
import plus from "../../public/icons/plus.svg";
import phoneLogo from "../../public/icons/phoneLogo.svg";
import copy from "../../public/icons/copyLogo.svg";
import hospitalLogo from "../../public/icons/hospitalLogo.svg";
import cancelLogo from "../../public/icons/cancelLogo.svg";
import timeLogo from "../../public/icons/timeLogo.svg";
import Image from "next/image";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import AppointmentList from "./AppointmentList.jsx";
import InfoRow from "./InfoRow.jsx";
import DoctorCard from "./DoctorCard.jsx";
import ActionButtons from "./ActionButtons.jsx";
import AppointmentDetails from "./AppointmentDetails.jsx";

const APPOINTMENTS = [
    {id: 1, date: "Mon, 16.03.26", time: "10:00 - 10:30", doctor: "Dr. Sarah Wilson", department: "Cardiology", patient: "Emily Johnson", profilePic: ProfilePic, icon: userIcon},
    {id: 2, date: "Mon, 17.03.26", time: "10:00 - 10:30", doctor: "Dr. Sarah Wilson", department: "Physiotherapy", patient: "Emily Johnson", profilePic: ProfilePic, icon: userIcon},
    {id: 3, date: "Mon, 18.03.26", time: "10:00 - 10:30", doctor: "Dr. Sarah Wilson", department: "Cardiology", patient: "Emily Johnson", profilePic: ProfilePic, icon: userIcon},
]

export default function AppointmentPage() {
    const [selectedAppointment, setSelectedAppointment] = useState(APPOINTMENTS[0]);
    const [collapsed, setCollapsed] = useState(false);

    return (
       <div className="bg-[#F7FAFC] flex ">
        <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        />

        {/* Appointments Listing */}
            <AppointmentList
                appointments={APPOINTMENTS}
                collapsed={collapsed}
                selectedAppointment={selectedAppointment}
                onSelectAppointment={setSelectedAppointment}
            />

        {/* Appointment details */}
            <AppointmentDetails
                appointment={selectedAppointment}
            />
       </div> 
    )
}