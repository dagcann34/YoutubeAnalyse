import { createContext, useContext } from 'react';
import { makeT, type Lang, type Translate } from '../i18n';

export const LangContext = createContext<{ lang: Lang; t: Translate }>({ lang: 'en', t: makeT('en') });

export const useI18n = () => useContext(LangContext);
