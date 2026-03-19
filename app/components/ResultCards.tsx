import { ApiResponseData } from "../types";
import { AnimatePresence, motion } from "motion/react";
import { Map, Marker } from "pigeon-maps";
import { osm } from "pigeon-maps/providers";

interface ResultCardsProps {
  results: ApiResponseData[];
}

export default function ResultCards({ results }: ResultCardsProps) {
  console.log({
    lat: parseFloat(results[0].lat),
    lon: parseFloat(results[0].lon),
  });
  return (
    <div className="w-full max-w-5xl text-white">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 max-h-82 overflow-y-scroll scroll-container pr-2">
        {results.map((location) => (
          <AnimatePresence key={location.place_id}>
            <motion.div
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ease: "easeOut", duration: 0.3 }}
              exit={{ opacity: 0 }}
              className="flex min-h-48 flex-col items-center justify-evenly rounded border border-slate-600 p-2 text-center shadow-orange-200 transition-all duration-200 hover:border-orange-400 hover:bg-orange-100/10 cursor-copy hover:shadow-md"
            >
              <div className="flex text-sm w-full text-gray-300 gap-2 justify-between px-4">
                <p>{location.address.country}</p>
                <p className="font-semibold">
                  {location.address.state || location.address.state_district}
                </p>
              </div>
              <div className="w-full h-12 text-orange-50 font-black tracker-wider text-xl flex items-center justify-center">
                {location.address.city ||
                  location.address.town ||
                  location.address.suburb ||
                  location.address.village ||
                  location.address.neighbourhood}
              </div>
              <div className="w-full text-blue-50 font-black tracker-wider text-5xl flex items-center justify-center pb-2 ">
                {location.address.postcode}
              </div>
              <Map
                animate={true}
                height={200}
                defaultCenter={[
                  parseFloat(location.lat),
                  parseFloat(location.lon),
                ]}
                defaultZoom={16}
                maxZoom={16}
                minZoom={16}
              >
                <Marker
                  width={50}
                  anchor={[parseFloat(location.lat), parseFloat(location.lon)]}
                  color={"orange"}
                />
              </Map>
            </motion.div>
          </AnimatePresence>
        ))}
      </div>
    </div>
  );
}

// <AnimatePresence key={location.place_id}>
//             <motion.div
//               initial={{ opacity: 0, y: 3 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ ease: "easeOut", duration: 0.3 }}
//               exit={{ opacity: 0 }}
//               className="flex min-h-48 flex-col items-center justify-evenly rounded border border-slate-600 px-6 py-4 text-center shadow-orange-200 transition-all duration-200 hover:border-orange-300 hover:bg-orange-100/10 hover:shadow-md"
//             >
//               <p className="text-xs text-gray-400">
//                 {location.address.country}
//               </p>
//               <p className="text-md text-gray-200">
//                 {location.address.state || location.address.state_district}
//               </p>
//               <h2 className="text-lg font-bold text-orange-500">
//                 {location.address.city ||
//                   location.address.town ||
//                   location.address.suburb ||
//                   location.address.village ||
//                   location.address.neighbourhood}
//               </h2>
//               <Map
//                 animate={true}
//                 height={200}
//                 defaultCenter={[
//                   parseFloat(location.lat),
//                   parseFloat(location.lon),
//                 ]}
//                 defaultZoom={16}
//                 maxZoom={16}
//                 minZoom={16}
//               >
//                 <Marker
//                   width={50}
//                   anchor={[parseFloat(location.lat), parseFloat(location.lon)]}
//                   color={"orange"}
//                 />
//               </Map>
//               <div className="flex justify-center w-full font-semibold">
//                 <span className="text-orange-500 mr-2">CP:</span>
//                 <p className="text-yellow-400">{location.address.postcode}</p>
//               </div>
//             </motion.div>
//           </AnimatePresence><AnimatePresence key={location.place_id}>
//             <motion.div
//               initial={{ opacity: 0, y: 3 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ ease: "easeOut", duration: 0.3 }}
//               exit={{ opacity: 0 }}
//               className="flex min-h-48 flex-col items-center justify-evenly rounded border border-slate-600 px-6 py-4 text-center shadow-orange-200 transition-all duration-200 hover:border-orange-300 hover:bg-orange-100/10 hover:shadow-md"
//             >
//               <p className="text-xs text-gray-400">
//                 {location.address.country}
//               </p>
//               <p className="text-md text-gray-200">
//                 {location.address.state || location.address.state_district}
//               </p>
//               <h2 className="text-lg font-bold text-orange-500">
//                 {location.address.city ||
//                   location.address.town ||
//                   location.address.suburb ||
//                   location.address.village ||
//                   location.address.neighbourhood}
//               </h2>
//               <Map
//                 animate={true}
//                 height={200}
//                 defaultCenter={[
//                   parseFloat(location.lat),
//                   parseFloat(location.lon),
//                 ]}
//                 defaultZoom={16}
//                 maxZoom={16}
//                 minZoom={16}
//               >
//                 <Marker
//                   width={50}
//                   anchor={[parseFloat(location.lat), parseFloat(location.lon)]}
//                   color={"orange"}
//                 />
//               </Map>
//               <div className="flex justify-center w-full font-semibold">
//                 <span className="text-orange-500 mr-2">CP:</span>
//                 <p className="text-yellow-400">{location.address.postcode}</p>
//               </div>
//             </motion.div>
//           </AnimatePresence>
