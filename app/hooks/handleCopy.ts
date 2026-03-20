import { Slide, toast } from "react-toastify";
import { StringCopied } from "../components/StringCopied";

export const handleCopy = async (textToCopy: string) => {
  try {
    await navigator.clipboard.writeText(textToCopy);
    toast.info(`Copiado ${textToCopy} al clipboard`, {
      position: "bottom-right",
      autoClose: 800,
      hideProgressBar: true,
      closeOnClick: false,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "dark",
      transition: Slide,
    });
  } catch (err) {
    console.error("Failed to copy: ", err);
  }
};
