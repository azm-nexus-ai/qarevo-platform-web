import type { StaticImageData } from "next/image";

export type Appointment = {
  id: number;
  date: string;
  time: string;
  doctor: string;
  department: string;
  patient: string;
  profilePic: StaticImageData;
  icon: StaticImageData;
};