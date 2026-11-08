// import { Doctor } from "../types";

import type { Doctor } from "../types";

export const mockDoctors: Doctor[] = [
  {
    id: "doc1",
    name: "Dra. Ana Beatriz Costa",
    email: "ana.beatriz@clinica.com",
    specialty: "Cardiologia",
    crm: "SP123456",
    rating: 4.8,
    experience: "12 anos",
    avatar: "👩‍⚕️",
    price: 280,
    availableDays: [1, 3, 5],
    schedule: {
      "1": ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
      "3": ["08:30", "09:30", "10:30", "13:00", "14:00", "15:30"],
      "5": ["09:00", "10:30", "11:30", "14:30", "16:00"],
    },
    location: "Consultório 304 - Torre Norte",
  },
];
