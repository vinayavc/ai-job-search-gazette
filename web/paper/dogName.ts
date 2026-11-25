// The dachshund's name, as set in the UI (saved in ui/.state). Defaults to "Doxie".
import { createContext, useContext } from "react";
export const DogNameContext = createContext("Doxie");
export const useDogName = () => useContext(DogNameContext);
