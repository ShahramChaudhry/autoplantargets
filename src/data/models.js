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
    "Special Sales": toyotaRetail,
    "External Dealer": toyotaRetail,
    "SME Fleet": toyotaCorporate,
    "Corporate Fleet": toyotaCorporate,
    "eCom Retail": toyotaRetail,
  },
  Honda: {
    Retail: hondaRetail,
    Fleet: hondaFleet,
    "Special Sales": hondaRetail,
    "External Dealer": hondaRetail,
    "SME Fleet": hondaCorporate,
    "Corporate Fleet": hondaCorporate,
    "eCom Retail": hondaRetail,
  },
};
