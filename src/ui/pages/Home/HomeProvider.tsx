import { createContext, useContext } from 'react';

type HomeContextType = {};

export const HomeContext = createContext<HomeContextType>({});

export const useHomeData = () => {
    return useContext(HomeContext);
};

type Props = {
    children: React.ReactNode;
};

export default function HomeProvider(props: Props) {
    return <HomeContext.Provider value={{}}>{props.children}</HomeContext.Provider>;
}
