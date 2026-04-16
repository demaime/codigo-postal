//con iinterrfacce + eextends

export interface ApiResponseData {
  place_id: number;
  address: Address;
  lat: string;
  lon: string;
}

export interface DataWithDistance extends ApiResponseData {
  distance: number;
}

export type UserLocation = {
  userLat: number;
  userLon: number;
};

type Address = {
  house_number: string;
  road: string;
  neighbourhood: string;
  city?: string;
  city_district?: string;
  state_district?: string;
  town?: string;
  suburb?: string;
  village?: string;
  state: string;
  ISO3166_2_lvl4: string;
  postcode: string;
  country: string;
  country_code: string;
};

//con type + &

// export type ApiResponseData = {
//   place_id: number;
//   address: Address;
//   lat: string;
//   lon: string;
//   // distance: number;
// };

// export type DataWithDistance = ApiResponseData & {
//   distance: number;
// };
