'use client';

import { useState, type Dispatch, type SetStateAction } from "react";import Image from "next/image";
import type { StaticImageData } from "next/image";
import {ChevronRight, Menu, X } from "lucide-react";

import Appointments from "../public/icons/appointmentLogo.svg";
import Messages from "../public/icons/messageLogo.svg";
import MyDoctors from "../public/icons/DoctorsLogo.svg";
import MedicalRecords from "../public/icons/medicalRecordIcon.svg";
import Notifications from "../public/icons/notification.svg";
import Support from "../public/icons/support.svg";
import HelpCenter from "../public/icons/HelpCenter.svg";
import SideBar from "../public/icons/sideBar.svg";
import QarevoHealth from "../public/icons/qarevoHealth.svg";
import plusLogo from "../public/icons/plusLogo.svg";

type NavButtonProps = {
  id: string;
  label: string;
  icon: StaticImageData;
};

type SidebarProps = {
  activeId?: string;
  onNavigate?: (id: string) => void;

  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;

  mobileOpen: boolean;
  setMobileOpen: Dispatch<SetStateAction<boolean>>;
};

type NavItem = {
  id: string;
  label: string;
  icon: StaticImageData;
};

const NAV_ITEMS: NavItem[] = [
  { id: "appointments", label: "Appointments", icon: Appointments },
  { id: "messages", label: "Messages", icon: Messages },
  { id: "myDoctors", label: "My Doctors", icon: MyDoctors },
  { id: "medicalRecords", label: "Medical Records", icon: MedicalRecords },
];

const FOOTER_ITEMS: NavItem[] = [
  { id: "notifications", label: "Notifications", icon: Notifications },
  { id: "support", label: "Support", icon: Support },
  { id: "helpCenter", label: "Help Center", icon: HelpCenter },
];

export default function Sidebar({
  activeId: activeIdProp,
  onNavigate,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: SidebarProps) {
  
  const [internalActive, setInternalActive] = useState<string>("appointments");
  const activeId = activeIdProp ?? internalActive;

  const handleSelect = (id: string) => {
    setInternalActive(id);
    onNavigate?.(id);
  };

  const NavButton = ({ id, label, icon } : NavButtonProps) => {
    const isActive = activeId === id;

    return (
      <button
        onClick={() => handleSelect(id)}
        title={collapsed ? label : undefined}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        className={[
          "group relative flex items-center cursor-pointer w-full rounded-lg text-md  transition-colors",
          collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
          isActive
            ? "bg-[#E6EEF2] font-bold text-[#074360]"
            : "text-[#2D6480] font-medium",
        ].join(" ")}
      >
        <Image
          src={icon}
          alt={label}
          width={25}
          height={25}
        />

        {!collapsed && <span className="truncate">{label}</span>}  
      </button>
    );
  };

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-[#F7FAFC] px-4 py-3 shadow-sm">
        
      {/* Menu */}
      <button onClick={() => setMobileOpen(true)}>
        <Menu size={24} />
      </button>

      {/* Logo */}
      <Image
        src={QarevoHealth}
        alt="Qarevo Health"
        width={150}
        height={40}
      />

      {/* Profile */}
      <div className="bg-[#B2DDFF] w-10 h-10 rounded-full flex items-center justify-center">
        <h1 className="text-[#074360] font-bold">AN</h1>
      </div>
    </div>    

      {/* Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        />
      )}
    
      <div
        className={`
          fixed top-0 left-0 z-50 h-screen bg-[#F7FAFC]
          transition-transform duration-300 ease-in-out flex flex-col
          ${collapsed ? "w-[72px]" : "w-64"}

          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }

          lg:translate-x-0
        `}
      >
      <button
        onClick={() => setMobileOpen(false)}
        className={`lg:hidden absolute top-4 text-[#2D6480] ${collapsed ? "right-6" : "right-4"}`}
      >
        <X size={24} />
      </button>
      
      <div
        className={[
          "flex items-center h-22 pt-5 shrink-0 border-slate-200",
          collapsed ? "justify-center px-0" : "justify-between px-4",
        ].join(" ")}
      >
        {!collapsed && (
          <Image
            src={QarevoHealth}
            alt="Qarevo Health"
            width={180}
            height={100}
          />
        )}

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center  cursor-pointer h-8 w-8 rounded-md"
        >
          <Image
            src={SideBar}
            alt="Toggle Sidebar"
            width={25}
            height={25}
          />
        </button>
      </div>

       <button className="flex justify-center bg-white border border-[#94B5C7] rounded-lg px-2 py-2.5 mx-2 mt-6 gap-2 items-center">
        <Image
          src={plusLogo}
          alt="Plus Logo"
          width={20}
          height={20}
        />
        {!collapsed && <p className="text-[#1C375E] font-bold text-sm ">Schedule Visit</p>}
      </button>

      <nav className="hidden lg:flex flex-1 flex-col px-2 py-4 space-y-1">
        {NAV_ITEMS.map((item: NavItem) => (
          <NavButton key={item.id} {...item}  />
        ))}
      </nav>

      <div className="px-2 py-4 border-b border-slate-200 space-y-1">
        {FOOTER_ITEMS.map((item: NavItem) => (
          <NavButton key={item.id} {...item} />
        ))}
      </div>

      <div className="px-2 ml-2 py-4 flex gap-3 ">
        <div className="bg-[#B2DDFF] w-10 h-10 rounded-full">
            <h1 className="text-[#074360] font-bold p-2">AN</h1>
        </div>

        {!collapsed && (
          <>
          <div className="flex flex-col">
            <h3 className="text-[#074360] text-medium font-medium">Emily Johnson</h3>
            <p className="text-sm text-[#2D6480]">email@domain.com</p>
            </div>

            <button className="cursor-pointer">
              <ChevronRight
              className="text-[#2D6480] ml-auto"
              height={30}
              width={30}
              />
            </button>
            </>
            )}
      </div>
    </div>
    </>
  );
}