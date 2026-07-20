import Appointments from "../public/icons/appointmentLogo.svg";
import Messages from "../public/icons/messageLogo.svg";
import MyDoctors from "../public/icons/DoctorsLogo.svg";
import MedicalRecords from "../public/icons/medicalRecordIcon.svg";
import homeIcon from "../public/icons/homeIcon.svg";
import Image from "next/image";

export default function MobileBottomNav({ activeId, onNavigate }) {
  const ITEMS = [
    { id: "home", label: "Home", icon: homeIcon },
    { id: "appointments", label: "Appointments", icon: Appointments },
    { id: "messages", label: "Messages", icon: Messages },
    { id: "myDoctors", label: "Doctors", icon: MyDoctors },
    { id: "records", label: "Records", icon: MedicalRecords },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white flex justify-around py-2 z-50">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className="flex flex-col items-center gap-1"
        >
          <Image
            src={item.icon}
            alt={item.label}
            width={22}
            height={22}
          />

          <span
            className={`text-xs ${
              activeId === item.id
                ? "text-[#074360] font-semibold"
                : "text-[#2D6480]"
            }`}
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}