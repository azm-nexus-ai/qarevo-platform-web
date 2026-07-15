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
import video from "../../public/icons/videoLogo.svg"
import Image from "next/image";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

const APPOINTMENTS = [
    {id: 1, date: "Mon, 16.03.26", time: "10:00 - 10:30", doctor: "Dr. Sarah Wilson", department: "Cardiology", patient: "Emily Johnson", profilePic: ProfilePic, icon: userIcon},
    {id: 2, date: "Mon, 16.03.26", time: "10:00 - 10:30 AM", doctor: "Dr. Sarah Wilson", department: "Cardiology", patient: "Emily Johnson", profilePic: ProfilePic, icon: userIcon},
    {id: 3, date: "Mon, 16.03.26", time: "10:00 - 10:30 AM", doctor: "Dr. Sarah Wilson", department: "Cardiology", patient: "Emily Johnson", profilePic: ProfilePic, icon: userIcon},
]

export default function AppointmentPage() {
    const [collapsed, setCollapsed] = useState(false);

    return (
       <div className="bg-[#F7FAFC] flex ">
        <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        />

        {/* Appointments */}
        <div className={`bg-white w-90 my-5 p-3 rounded-lg transition-all duration-200 ${collapsed ? "ml-[72px]" : "ml-64"}`}>
            <h1 className="text-[#074360] font-bold">My next appointments</h1>

            <div className="flex flex-col gap-4 mt-4">
                {APPOINTMENTS.map((appointment) => (
                    <div
                    key={appointment.id}
                    className="border-2 border-[#074360] rounded-xl shadow-sm"
                    >
                    <div className="flex gap-4 items-center bg-[#074360] p-3 rounded-t-lg text-white text-sm">
                        <div className="flex items-center gap-2">
                        <Calender className="text-white"/>
                        <p>{appointment.date}</p>
                        </div>

                        <div className="flex items-center gap-2 ">
                        <Clock className="text-white"/>
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
                        <h3 className="font-semibold text-[#022838]">{appointment.doctor}</h3>
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
                ))}
            </div>

            <div className="bg-[#F7FAFC] flex justify-between px-3 items-center mt-10 rounded-lg">
                <p className="text[#074360] font-semibold">Past Appointments</p>
                <div className="flex flex-col">
                    <button><ChevronUp/></button>
                    <button><ChevronDown/></button>
                </div>
            </div>
        </div>

            {/* Appointment details */}
            <div className={ `flex flex-col w-175 my-5 border bg-white border-[#E6EEF2] rounded-lg transition-all duration-200 ${collapsed ? "ml-4" : "ml-4"}` }>

            <div className= "bg-[#074360] flex justify-between px-5 py-3 rounded-t-lg items-center">
                <h1 className="font-bold text-white text-lg">Appointment Details</h1>

                <div className="flex justify-between items-center">
                   <Image
                    src={icon1}
                    alt="icon"
                    width={50}
                    height={50}
                   /> 
                   <Image
                    src={icon2}
                    alt="icon2"
                    width={100}
                    height={100}
                   /> 
                </div>
            </div>
            <div className= "bg-[#E6EEF2] px-5 py-3 flex gap-3">
                <div className="flex items-center gap-2 text-[#074360]">
                    <Calender className="text-[#074360]"/>
                    <p>{APPOINTMENTS[0].date}</p>
                    </div>

                    <div className="flex items-center gap-2 text-[#074360]">
                    <Clock className="text-[#074360]" />
                    <p>{APPOINTMENTS[0].time}</p>
                </div>
            </div>

            <div className="px-10">
            <div className="bg-[#F7FAFC] px-4 py-2 mt-10 mb-0 border border-[#C2D5DF] rounded-lg shadow-sm">
                <div className="flex items-center gap-3 ">
                        <Image
                        src={APPOINTMENTS[0].profilePic}
                        alt={APPOINTMENTS[0].doctor}
                        width={60}
                        height={60}
                        />

                        <div>
                        <h3 className="font-bold text-lg text-[#1A365D]">{APPOINTMENTS[0].doctor}</h3>
                        <p className="text-[#022838]">
                            {APPOINTMENTS[0].department}
                        </p>
                        </div>
                </div>
            </div>

            <div className="flex mt-7 gap-5 ">
                <div className="flex">
                <button className="bg-[#1E70CC] flex gap-3 py-2 text-white border rounded-r-none rounded-lg px-34 border-[#175CD3] shadow-sm">
                    <Image
                        src={videoIcon}
                        alt="videoicon"
                    />
                    <h3>Join Call</h3>
                </button>
                <button className="bg-[#1E70CC] rounded-l-none rounded-lg border-2 border-l-white border-l px-3 py-2 border-[#175CD3] shadow-sm">
                    <Image
                        src={copyIcon}
                        alt="copyicon"
                    />
                </button>
                </div>
                <button className="border-[#94B5C7] border shadow-sm rounded-lg flex gap-2 py-2 px-15">
                    <Image
                    src={Chat}
                    alt="chaticon" 
                    />
                    Chat
                </button>
            </div>

            <div className="flex gap-4 border-y border-y-[#C2D5DF] mt-10 py-5 items-center">
                <div className="bg-[#B2DDFF] p-3 rounded-lg">
                <Image
                src={document}
                alt="document"
                />
                </div>

                <div>
                    <h3 className="font-bold text-[#074360]">Send documents</h3>
                    <p className="text-sm text-[#022838]">Share your previous medical history, including any diagnoses or additional details if available.</p>
                </div>

                <button>
                    <ChevronRight/>
                </button>
            </div>   

            <div className="flex gap-4 border-b border-b-[#C2D5DF] py-5 items-center">
                <div className="bg-[#B2DDFF] p-3 rounded-lg">
                <Image
                src={calenderIcon}
                alt="calenderIcon"
                />
                </div>

                <div>
                    <h3 className="font-bold text-[#074360]">Add to my calendar</h3>
                </div>

                <button className="ml-auto">
                    <ChevronRight/>
                </button>
            </div>   

            <div className="flex flex-col gap-2 border-b border-b-[#C2D5DF] py-5">
                <h3 className="font-bold text-[#074360]">Consultation details</h3>

                <div className="flex gap-4">
                    <div className="flex gap-4 items-center">
                        <div className="bg-[#B2DDFF] p-3 rounded-lg">
                        <Image
                        src={consultation}
                        alt="consultationIcon"
                        />
                        </div>
                        <h3 className="text-[#101828]">General consultation</h3>
                    </div>

                    <div className="flex gap-4">
                        <div className="bg-[#B2DDFF] p-3 rounded-lg">
                        <Image
                        src={location}
                        alt="locationIcon"
                        />
                        </div>
                        <div className="border bg-[#ABEFC61A] border-[#0F7A48] rounded-lg flex gap-1 item-center p-2">
                            <Image
                            src={video}
                            alt="videoIcon"
                            />
                            <p className="text-[#0F7A48]">Online session</p>
                        </div>
                    </div>
                </div>
            </div>  
                
            </div>   
            </div>
       </div> 
    )
}