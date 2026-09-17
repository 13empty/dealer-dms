export const CA_PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "SK", name: "Saskatchewan" },
  { code: "MB", name: "Manitoba" },
  { code: "ON", name: "Ontario" },
  { code: "QC", name: "Quebec" },
  { code: "NB", name: "New Brunswick" },
  { code: "NS", name: "Nova Scotia" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "YT", name: "Yukon" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
] as const;

export const SHOP_DEFAULTS = {
  city: "Calgary",
  province: "AB",
  country: "Canada",
  taxLabel: "GST",
  taxRate: 5,
  laborRate: 145,
  address: "Calgary, AB, Canada",
  invoiceNotes: "Prices in CAD. GST 5% (Alberta — no provincial sales tax).",
};
