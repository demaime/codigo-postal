import { Slide, toast } from "react-toastify";

export const handleCopy = async (textToCopy: string) => {
  try {
    await navigator.clipboard.writeText(textToCopy);
    toast.info(
      <div className="flex gap-1">
        <p>Copiado</p>
        <span className="font-bold">{textToCopy}</span>
        <p>al clipboard</p>
      </div>,
      {
        position: "bottom-right",
        autoClose: 800,
        hideProgressBar: true,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        transition: Slide,
      },
    );
  } catch (err) {
    console.error("Failed to copy: ", err);
  }
};
