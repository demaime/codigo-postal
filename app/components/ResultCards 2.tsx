import { ApiResponseData } from "../types";
import { AnimatePresence, motion } from "motion/react";
import { Map, Marker } from "pigeon-maps";
import { handleCopy } from "../helpers/handleCopy";
import { MdFileCopy } from "react-icons/md";
import { ToastContainer } from "react-toastify";
interface ResultCardsProps {
  results: ApiResponseData[];
}

export default function ResultCards({ results }: ResultCardsProps) {
  return (
    <div className="h-full w-full min-h-0 text-white">
      <div className="flex flex-col h-full min-h-0 gap-4 overflow-y-auto scroll-container p-4 lg:p-8">
        {results.map((location) => (
          <AnimatePresence key={location.place_id}>
            <motion.div
              onClick={() => handleCopy(location.address.postcode)}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ease: "easeIn", duration: 0.3 }}
              exit={{ opacity: 0 }}
              whileHover={{
                scale: 1.02,
                transition: { duration: 0.1, delay: 0 },
              }}
              className="relative group flex flex-col items-center justify-evenly rounded-lg px-4 py-2 card-gradient-bg cursor-copy card-shadow"
            >
              {location.address.postcode ? (
                <div className="w-full font-black tracking-wider text-5xl flex items-center justify-start pb-2 ">
                  {location.address.postcode}{" "}
                </div>
              ) : (
                <div className="w-full text-amber-100 font-semibold tracking-wider text-md flex items-center justify-center pb-2">
                  No se informa el <br />
                  Código Postal :(
                </div>
              )}
              <ToastContainer />
              <div className="flex flex-col items-center justify-center absolute top-4 right-4 h-12 opacity-0 transition-all duration-100 group-hover:opacity-80">
                <MdFileCopy className="h-6 w-6 text-orange-200" />
                <p className="text-orange-300 text-xs">Copiar</p>
              </div>

              <h1 className="font-semibold text-md text-amber-400 w-full text-start">
                {location.address.state || location.address.state_district}
              </h1>

              <div className="w-full h-12 text-white font-bold tracking-wider text-xl flex items-center justify-center">
                {location.address.city ||
                  location.address.town ||
                  location.address.suburb ||
                  location.address.village ||
                  location.address.neighbourhood}
              </div>

              {/* <Map
                  animate={true}
                  defaultCenter={[
                    parseFloat(location.lat),
                    parseFloat(location.lon),
                  ]}
                  defaultZoom={16}
                  mouseEvents={false}
                >
                  <Marker
                    width={50}
                    anchor={[
                      parseFloat(location.lat),
                      parseFloat(location.lon),
                    ]}
                    color={"orange"}
                  />
                </Map> */}
            </motion.div>
          </AnimatePresence>
        ))}
      </div>
    </div>
  );
}
