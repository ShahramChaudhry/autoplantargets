const toyotaCorporate = ["Corolla", "Camry", "Hilux", "Prado"];
const toyotaRetail = ["Corolla", "Camry", "Yaris", "Prado", "Hiace"];
const toyotaFleet = ["Hilux", "Hiace", "Prado"];

const hondaCorporate = ["CRVEX485CM", "ACLAT263CEZ"];
const hondaRetail = ["CRVEX485CM", "CRVEX485DMS", "ACLXA262FEX"];
const hondaFleet = ["CRVEX485EMS", "CRVEX485FMS"];

/**
 * Models by Division → Sales Group name.
 * Vehicle-sales groups share Retail/Fleet/Corporate packs for MVP.
 * Unlisted groups return [] via getModels().
 */
export const models = {
  Toyota: {
    Retail: toyotaRetail,
    Fleet: toyotaFleet,
    "Corporate Fleet": toyotaCorporate,
    "SME Fleet": toyotaCorporate,
    Government: toyotaCorporate,
    Institutional: toyotaCorporate,
    "Special Sales": toyotaRetail,
    "External Dealer": toyotaRetail,
    "Dealer Sales": toyotaRetail,
    "eCom Retail": toyotaRetail,
    "eCom B2B": toyotaCorporate,
    B2B: toyotaCorporate,
    Exports: toyotaFleet,
    Trade: toyotaRetail,
    "Staff Sales": toyotaRetail,
    "Lease / Rent": toyotaFleet,
    "Limousine / RAC": toyotaFleet,
    Vans: toyotaFleet,
    Distributors: toyotaFleet,
    "Recon Veh (CV)": toyotaFleet,
  },
  Honda: {
    Retail: hondaRetail,
    Fleet: hondaFleet,
    "Corporate Fleet": hondaCorporate,
    "SME Fleet": hondaCorporate,
    Government: hondaCorporate,
    Institutional: hondaCorporate,
    "Special Sales": hondaRetail,
    "External Dealer": hondaRetail,
    "Dealer Sales": hondaRetail,
    "eCom Retail": hondaRetail,
    "eCom B2B": hondaCorporate,
    B2B: hondaCorporate,
    Exports: hondaFleet,
    Trade: hondaRetail,
    "Staff Sales": hondaRetail,
    "Lease / Rent": hondaFleet,
    "Limousine / RAC": hondaFleet,
    Vans: hondaFleet,
    Distributors: hondaFleet,
    "Recon Veh (CV)": hondaFleet,
  },
};
