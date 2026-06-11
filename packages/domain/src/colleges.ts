import type { College } from "./types";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const colleges: College[] = [
  {
    id: "sggs-nanded",
    name: "Shri Guru Gobind Singhji Institute of Engineering and Technology",
    domain: "sggs.ac.in",
    city: "Nanded",
    state: "Maharashtra",
    type: "government"
  },
  {
    id: "nit-trichy",
    name: "National Institute of Technology Tiruchirappalli",
    domain: "nitt.edu",
    city: "Tiruchirappalli",
    state: "Tamil Nadu",
    type: "government"
  },
  {
    id: "nit-warangal",
    name: "National Institute of Technology Warangal",
    domain: "nitw.ac.in",
    city: "Warangal",
    state: "Telangana",
    type: "government"
  },
  {
    id: "iit-bombay",
    name: "Indian Institute of Technology Bombay",
    domain: "iitb.ac.in",
    city: "Mumbai",
    state: "Maharashtra",
    type: "government"
  },
  {
    id: "iit-delhi",
    name: "Indian Institute of Technology Delhi",
    domain: "iitd.ac.in",
    city: "New Delhi",
    state: "Delhi",
    type: "government"
  },
  {
    id: "iit-kharagpur",
    name: "Indian Institute of Technology Kharagpur",
    domain: "iitkgp.ac.in",
    city: "Kharagpur",
    state: "West Bengal",
    type: "government"
  },
  {
    id: "iiit-hyderabad",
    name: "International Institute of Information Technology Hyderabad",
    domain: "iiit.ac.in",
    city: "Hyderabad",
    state: "Telangana",
    type: "deemed"
  },
  {
    id: "vit-vellore",
    name: "Vellore Institute of Technology",
    domain: "vitstudent.ac.in",
    city: "Vellore",
    state: "Tamil Nadu",
    type: "private"
  },
  {
    id: "bits-pilani",
    name: "BITS Pilani",
    domain: "pilani.bits-pilani.ac.in",
    city: "Pilani",
    state: "Rajasthan",
    type: "deemed"
  },
  {
    id: "coep-tech",
    name: "COEP Technological University",
    domain: "coeptech.ac.in",
    city: "Pune",
    state: "Maharashtra",
    type: "government"
  },
  {
    id: "pict-pune",
    name: "Pune Institute of Computer Technology",
    domain: "pict.edu",
    city: "Pune",
    state: "Maharashtra",
    type: "private"
  },
  {
    id: "manit-bhopal",
    name: "Maulana Azad National Institute of Technology Bhopal",
    domain: "manit.ac.in",
    city: "Bhopal",
    state: "Madhya Pradesh",
    type: "government"
  }
];

export const getCollegeByEmail = (email: string) => {
  const normalized = normalizeEmail(email);
  const domain = normalized.includes("@") ? normalized.split("@")[1] : "";
  return colleges.find((college) => college.domain === domain) ?? null;
};

export const isCollegeEmail = (email: string) => getCollegeByEmail(email) !== null;
