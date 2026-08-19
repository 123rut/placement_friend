import type { College } from "./types";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const colleges: College[] = [
  {
    id: "sggs-nanded",
    name: "Shri Guru Gobind Singhji Institute of Engineering and Technology",
    emailDomain: "sggs.ac.in",
    city: "Nanded",
    state: "Maharashtra",
    type: "government"
  },
  {
    id: "nit-trichy",
    name: "National Institute of Technology Tiruchirappalli",
    emailDomain: "nitt.edu",
    city: "Tiruchirappalli",
    state: "Tamil Nadu",
    type: "government"
  },
  {
    id: "nit-warangal",
    name: "National Institute of Technology Warangal",
    emailDomain: "nitw.ac.in",
    city: "Warangal",
    state: "Telangana",
    type: "government"
  },
  {
    id: "iit-bombay",
    name: "Indian Institute of Technology Bombay",
    emailDomain: "iitb.ac.in",
    city: "Mumbai",
    state: "Maharashtra",
    type: "government"
  },
  {
    id: "iit-delhi",
    name: "Indian Institute of Technology Delhi",
    emailDomain: "iitd.ac.in",
    city: "New Delhi",
    state: "Delhi",
    type: "government"
  },
  {
    id: "iit-kharagpur",
    name: "Indian Institute of Technology Kharagpur",
    emailDomain: "iitkgp.ac.in",
    city: "Kharagpur",
    state: "West Bengal",
    type: "government"
  },
  {
    id: "iiit-hyderabad",
    name: "International Institute of Information Technology Hyderabad",
    emailDomain: "iiit.ac.in",
    city: "Hyderabad",
    state: "Telangana",
    type: "deemed"
  },
  {
    id: "vit-vellore",
    name: "Vellore Institute of Technology",
    emailDomain: "vitstudent.ac.in",
    city: "Vellore",
    state: "Tamil Nadu",
    type: "private"
  },
  {
    id: "bits-pilani",
    name: "BITS Pilani",
    emailDomain: "pilani.bits-pilani.ac.in",
    city: "Pilani",
    state: "Rajasthan",
    type: "deemed"
  },
  {
    id: "coep-tech",
    name: "COEP Technological University",
    emailDomain: "coeptech.ac.in",
    city: "Pune",
    state: "Maharashtra",
    type: "government"
  },
  {
    id: "pict-pune",
    name: "Pune Institute of Computer Technology",
    emailDomain: "pict.edu",
    city: "Pune",
    state: "Maharashtra",
    type: "private"
  },
  {
    id: "manit-bhopal",
    name: "Maulana Azad National Institute of Technology Bhopal",
    emailDomain: "manit.ac.in",
    city: "Bhopal",
    state: "Madhya Pradesh",
    type: "government"
  },
  {
    id: "iiitp-pune",
    name: "Indian Institute of Information Technology Pune",
    emailDomain: "cse.iiitp.ac.in",
    city: "Pune",
    state: "Maharashtra",
    type: "government"
  },
];

export const getCollegeByEmail = (email?: string | null): College | null => {
  if (!email || typeof email !== "string") {
    return null;
  }
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) {
    return null;
  }
  const parts = normalized.split("@");
  const domain = parts[parts.length - 1];
  if (!domain) {
    return null;
  }
  return colleges.find((college) => college.emailDomain.toLowerCase() === domain) ?? null;
};

export const isCollegeEmail = (email?: string | null): boolean => getCollegeByEmail(email) !== null;

export const findCollegeById = (id?: string | null): College | null => {
  if (!id || typeof id !== "string") {
    return null;
  }
  const normalizedId = id.trim().toLowerCase();
  return colleges.find((college) => college.id.toLowerCase() === normalizedId) ?? null;
};

export const filterColleges = (
  list: College[],
  query?: string | null,
  limit?: number
): College[] => {
  if (!query || typeof query !== "string") {
    return typeof limit === "number" ? list.slice(0, limit) : list;
  }
  const term = query.trim().toLowerCase();
  if (!term) {
    return typeof limit === "number" ? list.slice(0, limit) : list;
  }
  const matched = list.filter((college) => {
    return (
      college.name.toLowerCase().includes(term) ||
      college.id.toLowerCase().includes(term) ||
      college.city.toLowerCase().includes(term) ||
      college.state.toLowerCase().includes(term) ||
      college.emailDomain.toLowerCase().includes(term)
    );
  });
  return typeof limit === "number" ? matched.slice(0, Math.max(1, limit)) : matched;
};

export const searchColleges = (query?: string | null, limit: number = 20): College[] => {
  if (!query || typeof query !== "string" || !query.trim()) {
    return [];
  }
  return filterColleges(colleges, query, limit);
};


