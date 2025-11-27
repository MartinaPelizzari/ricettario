import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ChefHat, CalendarDays, PlusSquare, BookOpen, User, Utensils, Zap, Edit, Save, X, ListTodo, Trash2, Shuffle, Loader2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

// --- CONFIGURAZIONE FIREBASE & UTILITIES ---

// VARIABILI GLOBALI (fornite dall'ambiente Canvas/Immersive)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Percorso del documento di Firestore per i dati condivisi
// Usiamo una collezione pubblica per simulare un piano condiviso tra gli utenti
const SHARED_PLAN_DOC_PATH = `artifacts/${appId}/public/data/shared_plans/shared_plan_data`;

// Dati Iniziali se il database è vuoto
const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const meals = ['Colazione', 'Spuntino_mattina', 'Pranzo', 'Spuntino_pomeriggio', 'Cena'];
const mealLabels = {
    Colazione: 'Colazione', Spuntino_mattina: 'Spuntino (Mattina)', Pranzo: 'Pranzo',
    Spuntino_pomeriggio: 'Spuntino (Pomeriggio)', Cena: 'Cena'
};
const categories = ['Colazione', 'Pranzo', 'Cena', 'Spuntino'];
const units = ['g', 'ml', 'unità', 'cucchiaio'];
const mealToCategoryMap = { Colazione: 'Colazione', Spuntino_mattina: 'Spuntino', Pranzo: 'Pranzo', Spuntino_pomeriggio: 'Spuntino', Cena: 'Cena' };

const createEmptyWeeklyPlan = () => {
  const emptyWeek = days.reduce((acc, day) => {
    acc[day] = meals.reduce((mAcc, meal) => ({ ...mAcc, [meal]: null }), {});
    return acc;
  }, {});
  return {
    'Settimana 1': { ...emptyWeek },
    'Settimana 2': { ...emptyWeek },
    'Settimana 3': { ...emptyWeek },
    'Settimana 4': { ...emptyWeek }, // Le 4 settimane sono ora qui
  };
};

const defaultInitialState = {
    recipes: [
        { id: 1, title: 'Oatmeal con Frutta Secca', category: 'Colazione', photoUrl: 'https://placehold.co/100x100/10b981/ffffff?text=Oatmeal', ingredients: [{ name: 'Fiocchi d\'Avena', quantity: 80, unit: 'g' }], procedure: 'Mescolare l\'avena...' },
        { id: 2, title: 'Insalata di Quinoa e Verdure', category: 'Pranzo', photoUrl: 'https://placehold.co/100x100/065f46/ffffff?text=Quinoa', ingredients: [{ name: 'Quinoa', quantity: 120, unit: 'g' }], procedure: 'Cuocere la quinoa...' },
        { id: 3, title: 'Smoothie Proteico', category: 'Spuntino', photoUrl: 'https://placehold.co/100x100/34d399/ffffff?text=Smoothie', ingredients: [{ name: 'Banana', quantity: 1, unit: 'unità' }], procedure: 'Frullare tutti gli ingredienti...' },
        { id: 4, title: 'Petto di Pollo al Limone', category: 'Cena', photoUrl: 'https://placehold.co/100x100/4ade80/ffffff?text=Pollo', ingredients: [{ name: 'Petto di Pollo', quantity: 150, unit: 'g' }], procedure: 'Cuocere il pollo in padella con limone.' },
        { id: 5, title: 'Toast Integrale e Avocado', category: 'Colazione', photoUrl: 'https://placehold.co/100x100/d9f99d/000000?text=Toast', ingredients: [{ name: 'Pane Integrale', quantity: 2, unit: 'unità' }, { name: 'Avocado', quantity: 50, unit: 'g' }], procedure: 'Tostare il pane e spalmare l\'avocado.' },
        { id: 6, title: 'Zuppa di Legumi Invernale', category: 'Pranzo', photoUrl: 'https://placehold.co/100x100/34d399/ffffff?text=Zuppa', ingredients: [{ name: 'Fagioli Secchi', quantity: 100, unit: 'g' }], procedure: 'Preparare il brodo e cuocere i legumi.' },
        
    ],
    weeklyPlan: createEmptyWeeklyPlan(),
    nutritionistPlan: {
        Martina: { 
            Colazione: [{ id: 1, text: 'Consuma 150g di Yogurt Greco con 30g di frutta secca a scelta (mandorle o noci) e un cucchiaino di miele.\nBevi una tazza di tè verde senza zucchero.' }], 
            Pranzo: [{ id: 4, text: '80g Riso Integrale o Farro con una porzione abbondante di verdure crude o cotte (broccoletti, spinaci, insalata).\nCondisci con un cucchiaio di olio EVO e limone.' }], 
            Cena: [{ id: 6, text: 'Proteine magre (150g Pollo/Tacchino/Pesce) e Verdure a volontà. Evita i carboidrati complessi la sera.' }], 
            Spuntino_mattina: [{ id: 7, text: 'Frutta fresca di stagione (es. una mela o una pera) o 2 gallette di riso.' }], 
            Spuntino_pomeriggio: [{ id: 8, text: '10g di Noci o un bicchiere di latte vegetale non zuccherato.' }] 
        },
        Carmen: { 
            Colazione: [{ id: 9, text: '100g di latte d\'avena con 40g di cereali integrali non zuccherati.\nAggiungi 50g di frutti di bosco freschi.' }], 
            Pranzo: [{ id: 11, text: '70g di Pasta Integrale con pomodoro fresco e basilico.\nCompleta con un contorno di fagiolini.' }], 
            Cena: [{ id: 13, text: 'Salmone al forno (120g) e asparagi cotti al vapore. Poco sale.' }], 
            Spuntino_mattina: [{ id: 14, text: 'Uno yogurt naturale magro.' }], 
            Spuntino_pomeriggio: [{ id: 15, text: 'Un quadratino di cioccolato fondente (>70%) e un infuso rilassante.' }] 
        },
    },
};

/**
 * Funzione per unire i dati di default con i dati di Firestore, garantendo che i campi esistano.
 * @param {Object} fetchedData I dati recuperati da Firestore.
 * @returns {Object} Lo stato dell'applicazione completo.
 */
const mergeData = (fetchedData) => {
    return {
        recipes: fetchedData?.recipes || defaultInitialState.recipes,
        weeklyPlan: fetchedData?.weeklyPlan || defaultInitialState.weeklyPlan,
        nutritionistPlan: fetchedData?.nutritionistPlan || defaultInitialState.nutritionistPlan,
    };
};

// --- HOOK PER GESTIRE FIREBASE ---

const useFirebaseApp = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dataState, setDataState] = useState(defaultInitialState);

    // 1. Inizializzazione Firebase e Autenticazione
    useEffect(() => {
        if (!firebaseConfig) {
            console.error("Firebase config non disponibile.");
            setIsLoading(false);
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const firebaseAuth = getAuth(app);
            
            setDb(firestore);
            setAuth(firebaseAuth);

            // Gestione Autenticazione
            onAuthStateChanged(firebaseAuth, async (user) => {
                if (!user) {
                    // Esegue l'accesso iniziale se non autenticato
                    if (initialAuthToken) {
                        await signInWithCustomToken(firebaseAuth, initialAuthToken);
                    } else {
                        // Accesso anonimo se il token non è disponibile (simulazione)
                        await signInAnonymously(firebaseAuth);
                    }
                }
                setUserId(firebaseAuth.currentUser?.uid || 'anonymous');
                setIsLoading(false);
            });
        } catch (error) {
            console.error("Errore nell'inizializzazione di Firebase:", error);
            setIsLoading(false);
        }
    }, []);

    // 2. Sottoscrizione ai Dati in Tempo Reale (onSnapshot)
    useEffect(() => {
        if (!db || !userId) return; // Non eseguire query senza db e utente

        const docRef = doc(db, SHARED_PLAN_DOC_PATH);

        // onSnapshot ascolta i cambiamenti in tempo reale
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                // Dati trovati, li uniamo ai valori di default per sicurezza
                const fetchedData = docSnap.data();
                setDataState(mergeData(fetchedData));
                console.log("Dati Firebase aggiornati in tempo reale.");
            } else {
                // Il documento non esiste, lo creiamo con i dati iniziali
                console.log("Documento non trovato. Creazione con dati di default...");
                setDoc(docRef, defaultInitialState, { merge: true }).catch(e => console.error("Errore nella creazione del documento:", e));
                setDataState(defaultInitialState);
            }
        }, (error) => {
            console.error("Errore durante l'ascolto di Firestore:", error);
        });

        // Cleanup function
        return () => unsubscribe();
    }, [db, userId]); // Rieseguire solo se db o userId cambiano

    // Funzione per salvare lo stato completo dell'applicazione
    const saveAppData = useCallback(async (newData) => {
        if (!db || !userId) {
            console.error("Database non pronto o utente non autenticato.");
            return;
        }
        const docRef = doc(db, SHARED_PLAN_DOC_PATH);
        try {
            await setDoc(docRef, newData);
            console.log("Stato salvato su Firestore con successo.");
        } catch (e) {
            console.error("Errore nel salvataggio su Firestore:", e);
        }
    }, [db, userId]);
    
    // Funzioni helper per aggiornare singoli pezzi di stato e salvare
    const updateRecipes = useCallback((newRecipes) => {
        saveAppData({ ...dataState, recipes: newRecipes });
    }, [dataState, saveAppData]);
    
    const updateWeeklyPlan = useCallback((newWeeklyPlan) => {
        saveAppData({ ...dataState, weeklyPlan: newWeeklyPlan });
    }, [dataState, saveAppData]);

    const updateNutritionistPlan = useCallback((newNutritionistPlan) => {
        saveAppData({ ...dataState, nutritionistPlan: newNutritionistPlan });
    }, [dataState, saveAppData]);


    return {
        isLoading,
        db,
        auth,
        userId,
        dataState,
        updateRecipes,
        updateWeeklyPlan,
        updateNutritionistPlan,
    };
};

// --- Componenti UI Generici (Invariati) ---

const Button = ({ children, onClick, className = '', type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    className={`w-full py-3 px-4 bg-emerald-600 text-white font-semibold rounded-xl shadow-md hover:bg-emerald-700 transition duration-150 ${className}`}
  >
    {children}
  </button>
);

const Input = ({ label, type = 'text', value, onChange, placeholder = '', name, icon: Icon }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <div className="relative">
      {Icon && <Icon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 ${Icon ? 'pl-10' : ''}`}
      />
    </div>
  </div>
);

const Select = ({ label, value, onChange, options, name }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-white"
    >
      {options.map((opt, index) => (
        <option key={index} value={opt.value || opt.label}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const IconButton = ({ icon: Icon, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-full hover:bg-emerald-100 transition duration-150 ${className}`}
  >
    <Icon size={20} className="text-emerald-700" />
  </button>
);


// --- Componenti Logici (Adattati per usare i dati sincronizzati) ---

/**
 * Funzione di utilità per selezionare un ID ricetta casuale da una categoria specifica.
 * @param {string} mealKey Chiave del pasto (es. 'Colazione', 'Pranzo').
 * @param {Array} recipes Lista completa delle ricette.
 * @returns {number | null} ID della ricetta casuale o null.
 */
const getRandomRecipeId = (mealKey, recipes) => {
  const targetCategory = mealToCategoryMap[mealKey];
  const filteredRecipes = recipes.filter(r => r.category.includes(targetCategory));
  if (filteredRecipes.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * filteredRecipes.length);
  return filteredRecipes[randomIndex].id;
};


// Planner Settimanale Componente (Adattato per usare updateWeeklyPlan)
const RecipeCardMini = ({ recipe, onSelect }) => (
  <div
    className="flex items-center p-2 bg-white rounded-lg shadow-sm border border-emerald-100 cursor-pointer hover:bg-emerald-50"
    onClick={() => onSelect(recipe.id)}
  >
    <img
      src={recipe.photoUrl}
      alt={recipe.title}
      className="w-8 h-8 rounded-full object-cover mr-3"
      onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/eeeeee/888888?text=Foto'; }}
    />
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-800 truncate">{recipe.title}</p>
      <p className="text-xs text-gray-500">{recipe.category}</p>
    </div>
  </div>
);

// MODIFICA CRITICA: Ora il modale riceve e filtra le ricette
const RecipeSelectorModal = ({ isOpen, onClose, onSelect, recipes, mealKey }) => {
  if (!isOpen) return null;
  
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Filtraggio per Categoria (basato su mealKey)
  const targetCategory = mealToCategoryMap[mealKey] || 'Tutte'; 
  const categoryFilteredRecipes = useMemo(() => {
    if (targetCategory === 'Tutte') return recipes;
    return recipes.filter(r => r.category.includes(targetCategory));
  }, [recipes, targetCategory]);
  
  // 2. Filtraggio per Ricerca
  const filteredRecipes = useMemo(() => {
      return categoryFilteredRecipes.filter(recipe => 
          recipe.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [categoryFilteredRecipes, searchTerm]);
  
  const modalTitle = `Seleziona Ricetta (${mealLabels[mealKey] || 'Pasto'})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-40">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-4 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-emerald-800">{modalTitle}</h3>
          <IconButton icon={X} onClick={onClose} />
        </div>
        
        {/* NUOVO: Barra di Ricerca */}
        <Input 
            icon={Search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca ricetta per nome..."
            className="mb-4"
        />

        <div className="space-y-3 overflow-y-auto">
          {filteredRecipes.length > 0 ? (
            filteredRecipes.map((recipe) => (
              <RecipeCardMini key={recipe.id} recipe={recipe} onSelect={(id) => { onSelect(id); onClose(); }} />
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">
              {categoryFilteredRecipes.length === 0 
                ? `Nessuna ricetta trovata nella categoria "${targetCategory}".`
                : `Nessuna ricetta corrisponde a "${searchTerm}".`
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const MealCard = ({ day, mealKey, recipe, onManualSelect, onRandomSelect, onClear, onRecipeClick }) => { // Aggiunto onRecipeClick
    const mealLabel = mealLabels[mealKey];

    return (
        <div
            className={`p-4 rounded-xl shadow-lg transition duration-150 border-l-4 ${recipe ? 'bg-white border-emerald-500' : 'bg-gray-50 border-gray-300'}`}
        >
            <p className="text-xs font-semibold uppercase text-emerald-600 mb-2">{mealLabel}</p>
            {recipe ? (
                // Ricetta Assegnata - Resa cliccabile per aprire i dettagli
                <div 
                    className="flex items-center mb-3 cursor-pointer hover:opacity-80 transition" // NEW: cursor-pointer e hover
                    onClick={() => onRecipeClick(recipe)} // NEW: gestisce il click
                >
                    <img 
                        src={recipe.photoUrl} 
                        alt={recipe.title} 
                        className="w-10 h-10 rounded-lg object-cover mr-3" 
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/eeeeee/888888?text=Foto'; }}
                    />
                    <p className="text-base font-bold text-gray-900">{recipe.title}</p>
                </div>
            ) : (
                // Nessuna Ricetta
                <p className="text-base text-gray-500 italic mb-3">Pasto non pianificato</p>
            )}

            {/* Azioni */}
            <div className="flex justify-around space-x-2 border-t pt-3 mt-3">
                {/* 1. Inserimento Manuale (Apre modale) */}
                <button 
                    onClick={() => onManualSelect(day, mealKey)}
                    className="flex-1 flex justify-center items-center text-xs text-emerald-600 bg-emerald-100 hover:bg-emerald-200 p-2 rounded-full transition"
                >
                    <Edit size={14} className="mr-1"/> Manuale
                </button>
                
                {/* 2. Genera Casualmente */}
                <button
                    onClick={() => onRandomSelect(day, mealKey)}
                    className="flex-1 flex justify-center items-center text-xs text-amber-600 bg-amber-100 hover:bg-amber-200 p-2 rounded-full transition"
                >
                    <Shuffle size={14} className="mr-1"/> Random
                </button>
                
                {/* 3. Elimina Ricetta */}
                <button
                    onClick={() => onClear(day, mealKey)}
                    className="flex-1 flex justify-center items-center text-xs text-red-600 bg-red-100 hover:bg-red-200 p-2 rounded-full transition"
                >
                    <Trash2 size={14} className="mr-1"/> Elimina
                </button>
            </div>
        </div>
    );
};


const WeeklyPlanner = ({ weeklyPlan, updateWeeklyPlan, recipes, activeWeek, setActiveWeek }) => {
  const weekOptions = Object.keys(weeklyPlan);
  const [activeDay, setActiveDay] = useState(days[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mealToEdit, setMealToEdit] = useState(null);
  const [selectedRecipeForDetails, setSelectedRecipeForDetails] = useState(null); // Stato per il modale dettagli

  const currentWeekPlan = weeklyPlan[activeWeek] || {};
  const currentDayPlan = currentWeekPlan[activeDay] || {};

  const getRecipeDetails = useCallback((id) => recipes.find(r => r.id === id), [recipes]);
  
  // Funzione per aggiornare un pasto specifico (e attivare il salvataggio su Firebase)
  const updateMeal = useCallback((day, mealKey, recipeId) => {
    const newWeeklyPlan = {
      ...weeklyPlan,
      [activeWeek]: {
        ...weeklyPlan[activeWeek],
        [day]: {
          ...weeklyPlan[activeWeek][day],
          [mealKey]: recipeId,
        }
      }
    };
    updateWeeklyPlan(newWeeklyPlan);
  }, [activeWeek, weeklyPlan, updateWeeklyPlan]);


  // 1. Inserimento Manuale (Mostra Modale)
  const handleManualSelect = (day, mealKey) => {
    setMealToEdit({ day, mealKey });
    setIsModalOpen(true);
  };
  
  // Gestisce la selezione dal Modale
  const handleRecipeSelectFromModal = (recipeId) => {
    if (mealToEdit) {
      updateMeal(mealToEdit.day, mealToEdit.mealKey, recipeId);
      setMealToEdit(null);
    }
  };

  // 2. Genera Casualmente (Singolo Pasto)
  const handleRandomSelect = (day, mealKey) => {
    const randomId = getRandomRecipeId(mealKey, recipes);
    if (randomId) {
        updateMeal(day, mealKey, randomId);
    } else {
        console.warn('Nessuna ricetta trovata per questa categoria!');
    }
  };

  // 3. Elimina Ricetta
  const handleClear = (day, mealKey) => {
    updateMeal(day, mealKey, null);
  };
  
  // Genera Casualmente l'intera giornata
  const handleRandomDay = () => {
      const newDayPlan = {};
      let changesMade = false;
      meals.forEach(mealKey => {
          const randomId = getRandomRecipeId(mealKey, recipes);
          if (randomId) {
              newDayPlan[mealKey] = randomId;
              changesMade = true;
          } else {
              newDayPlan[mealKey] = null;
          }
      });
      
      if(changesMade) {
          const newWeeklyPlan = {
              ...weeklyPlan,
              [activeWeek]: {
                  ...weeklyPlan[activeWeek],
                  [activeDay]: newDayPlan,
              }
          };
          updateWeeklyPlan(newWeeklyPlan);
      } else {
          console.warn('Impossibile generare la giornata. Assicurati di avere ricette nelle categorie Colazione, Pranzo, Cena e Spuntino.');
      }
  };

  // Gestisce il click sulla ricetta per visualizzare i dettagli
  const handleRecipeClick = useCallback((recipe) => {
      setSelectedRecipeForDetails(recipe);
  }, []);


  return (
    <div className="p-4 flex-1 overflow-auto">
      <h2 className="text-2xl font-bold text-emerald-800 mb-4">Planner Settimanale</h2>
      
      {/* Week Selector */}
      <Select
        label="Settimana di Pianificazione"
        value={activeWeek}
        onChange={(e) => setActiveWeek(e.target.value)}
        options={weekOptions.map(week => ({ label: week }))}
      />

      {/* Day Selector */}
      <div className="flex space-x-2 overflow-x-auto mb-4 pb-2 scrollbar-hide">
        {days.map(day => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition duration-150 ${
              activeDay === day
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {day.substring(0, 3)}
          </button>
        ))}
      </div>
      
      {/* Random Day Generator Button */}
      <Button 
          onClick={handleRandomDay} 
          className="bg-purple-600 hover:bg-purple-700 text-sm mb-4"
      >
          <Shuffle size={16} className="inline mr-2" /> Genera Giorno Casuale ({activeDay})
      </Button>

      {/* Meal Cards */}
      <div className="space-y-3">
        {meals.map(mealKey => (
            <MealCard
                key={mealKey}
                day={activeDay}
                mealKey={mealKey}
                recipe={getRecipeDetails(currentDayPlan[mealKey])}
                onManualSelect={handleManualSelect}
                onRandomSelect={handleRandomSelect}
                onClear={handleClear}
                onRecipeClick={handleRecipeClick}
            />
        ))}
      </div>
      <RecipeSelectorModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setMealToEdit(null); }}
        onSelect={handleRecipeSelectFromModal}
        recipes={recipes}
        mealKey={mealToEdit?.mealKey} // PASSARE LA CHIAVE DEL PASTO PER IL FILTRO
      />
      
      {/* Modale Visualizzazione Dettagli Ricetta */}
      {selectedRecipeForDetails && (
        <RecipeDetails 
            recipe={selectedRecipeForDetails} 
            onClose={() => setSelectedRecipeForDetails(null)} 
        />
      )}
    </div>
  );
};


// Componente Ricettario (Adattato per usare updateRecipes)
const RecipeBook = ({ recipes, updateRecipes }) => {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [filter, setFilter] = useState('Tutte');

  const filteredRecipes = useMemo(() => {
    if (filter === 'Tutte') {
      return recipes;
    }
    return recipes.filter(recipe => recipe.category.includes(filter));
  }, [recipes, filter]);

  const filterOptions = [{ label: 'Tutte', value: 'Tutte' }, ...categories.map(c => ({ label: c, value: c }))];
  
  // Gestisce il salvataggio delle modifiche (e attiva il salvataggio su Firebase)
  const handleSaveEdit = (updatedRecipe) => {
      const newRecipes = recipes.map(r => 
          r.id === updatedRecipe.id ? updatedRecipe : r
      );
      updateRecipes(newRecipes);
      setEditingRecipe(null);
  };
  
  const handleDeleteRecipe = (recipeId) => {
      // Sostituito window.confirm con un messaggio in console per conformità
      console.log(`Richiesta di eliminazione per la ricetta ID: ${recipeId}.`);
      const confirmed = true; // In un'app reale, si userebbe un modal
      
      if (confirmed) {
          const newRecipes = recipes.filter(r => r.id !== recipeId);
          updateRecipes(newRecipes);
      }
  }

  return (
    <div className="p-4 flex-1 overflow-auto">
      <h2 className="text-2xl font-bold text-emerald-800 mb-4">Ricettario</h2>
      
      {/* Filtro Ricette */}
      <Select 
        label="Filtra per Categoria"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        options={filterOptions}
      />
      
      {/* Elenco Ricette */}
      <div className="space-y-4 mt-4">
        {filteredRecipes.length > 0 ? (
            filteredRecipes.map(recipe => (
              <div
                key={recipe.id}
                className="flex items-center bg-white p-3 rounded-xl shadow-lg transition duration-300"
              >
                <img
                  src={recipe.photoUrl}
                  alt={recipe.title}
                  className="w-16 h-16 rounded-lg object-cover mr-4 shadow-md cursor-pointer"
                  onClick={() => setSelectedRecipe(recipe)}
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/eeeeee/888888?text=Foto'; }}
                />
                <div 
                    className="flex-1 cursor-pointer" 
                    onClick={() => setSelectedRecipe(recipe)}
                >
                  <p className="text-lg font-bold text-gray-900">{recipe.title}</p>
                  <p className="text-sm text-emerald-600">{recipe.category}</p>
                </div>
                
                <button
                    onClick={() => handleDeleteRecipe(recipe.id)}
                    className="p-2 ml-2 rounded-full text-red-500 hover:bg-red-100 transition"
                    aria-label={`Elimina ricetta ${recipe.title}`}
                >
                    <Trash2 size={20} />
                </button>
                
                <button
                    onClick={() => setEditingRecipe(recipe)}
                    className="p-2 ml-1 rounded-full text-emerald-500 hover:bg-emerald-100 transition"
                    aria-label={`Modifica ricetta ${recipe.title}`}
                >
                    <Edit size={20} />
                </button>
              </div>
            ))
        ) : (
            <p className="text-gray-500 text-center py-8">Nessuna ricetta trovata per la categoria "{filter}".</p>
        )}
      </div>
      
      {/* Modale Visualizzazione Dettagli */}
      {selectedRecipe && (
        <RecipeDetails recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
      )}
      
      {/* Modale Modifica Ricetta */}
      <EditRecipeModal
          recipe={editingRecipe}
          isOpen={!!editingRecipe}
          onClose={() => setEditingRecipe(null)}
          onSave={handleSaveEdit}
      />
    </div>
  );
};

// Componente per l'Editing della Ricetta (Invariato nella logica interna)
const EditRecipeModal = ({ recipe, isOpen, onClose, onSave }) => {
  if (!isOpen || !recipe) return null;
  
  const initialPhotoUrlInput = recipe.photoUrl.startsWith('https://placehold.co/') ? '' : recipe.photoUrl;
  
  const [formData, setFormData] = useState({
    ...recipe,
    photoUrlInput: initialPhotoUrlInput,
    photoUrl: recipe.photoUrl,
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
      const newUrl = formData.photoUrlInput 
          ? formData.photoUrlInput
          : `https://placehold.co/100x100/eeeeee/888888?text=${encodeURIComponent(formData.title || 'Foto Ricetta')}`;
      setFormData(prev => ({ ...prev, photoUrl: newUrl }));
  }, [formData.photoUrlInput, formData.title]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleIngredientChange = (index, field, value) => {
    const newIngredients = formData.ingredients.map((ing, i) => {
      if (i === index) {
        return { ...ing, [field]: value };
      }
      return ing;
    });
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { name: '', quantity: '', unit: 'g' }],
    });
  };

  const removeIngredient = (index) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.procedure || formData.ingredients.some(i => !i.name || !i.quantity)) {
      setMessage('Compila tutti i campi obbligatori.');
      return;
    }

    const updatedRecipe = {
      ...formData,
      ingredients: formData.ingredients.map(ing => ({
          ...ing,
          quantity: parseFloat(ing.quantity) || 0,
      })),
    };

    onSave(updatedRecipe);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-40">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-xl font-bold text-emerald-800">Modifica Ricetta: {recipe.title}</h3>
          <IconButton icon={X} onClick={onClose} />
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 flex-1">
          <div className="text-center">
            <img 
              src={formData.photoUrl} 
              alt="Anteprima Ricetta" 
              className="w-24 h-24 mx-auto mb-2 rounded-full object-cover" 
              onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/eeeeee/888888?text=Errore'; }}
            />
            <Input label="URL Foto o Testo Placeholder" name="photoUrlInput" value={formData.photoUrlInput} onChange={handleInputChange} placeholder="Incolla un URL o scrivi una parola" />
          </div>
          
          <Input label="Titolo Ricetta" name="title" value={formData.title} onChange={handleInputChange} placeholder="Es. Pasta al Pesto" />
          <Select label="Categoria" name="category" value={formData.category} onChange={handleInputChange} options={categories.map(c => ({ label: c }))} />
          
          <section className="bg-emerald-50 p-4 rounded-xl shadow-inner">
            <h3 className="text-lg font-bold text-emerald-800 mb-3 flex items-center"> <ListTodo size={20} className="mr-2" /> Ingredienti </h3>
            {formData.ingredients.map((ing, index) => (
              <div key={index} className="flex space-x-2 mb-3 items-end">
                <div className="flex-1"><Input label="Alimento" value={ing.name} onChange={(e) => handleIngredientChange(index, 'name', e.target.value)} placeholder="Nome ingrediente" /></div>
                <div className="w-1/4"><Input label="Qtà" type="number" value={ing.quantity} onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)} placeholder="Qtà" /></div>
                <div className="w-1/4"><Select label="Unità" value={ing.unit} onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)} options={units.map(u => ({ label: u }))} /></div>
                <IconButton icon={X} onClick={() => removeIngredient(index)} className="mb-4" />
              </div>
            ))}
            <button type="button" onClick={addIngredient} className="w-full py-2 border border-emerald-400 text-emerald-600 rounded-lg hover:bg-emerald-100 transition duration-150 text-sm font-medium flex items-center justify-center">
              <PlusSquare size={16} className="mr-2" /> Aggiungi Ingrediente
            </button>
          </section>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Procedimento</label>
            <textarea name="procedure" value={formData.procedure} onChange={handleInputChange} rows="5" placeholder="Descrivi i passaggi per la preparazione..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500" ></textarea>
          </div>
          
          {message && (<div className='p-3 rounded-lg text-sm font-medium bg-red-100 text-red-700'>{message}</div>)}

          <Button type="submit" className='mt-6'>
            <Save size={20} className="inline mr-2" /> Salva Modifiche
          </Button>
        </form>
      </div>
    </div>
  );
};


// Dettagli Ricetta (Visualizzazione) Componente (Invariato)
const RecipeDetails = ({ recipe, onClose }) => {
  if (!recipe) return null; // Aggiunto per robustezza
  const totalPeople = 2;

  const splitIngredients = useMemo(() => {
    return recipe.ingredients.map(ing => ({
      ...ing,
      quantityPerPerson: ing.unit === 'unità' ? ing.quantity / totalPeople : Math.round((ing.quantity / totalPeople) * 10) / 10,
    }));
  }, [recipe.ingredients]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="bg-white w-full h-[95vh] rounded-t-3xl shadow-2xl p-6 overflow-y-auto relative">
        <IconButton icon={X} onClick={onClose} className="absolute top-4 right-4 bg-gray-100" />
        <img src={recipe.photoUrl.replace('100x100', '400x300')} alt={recipe.title} className="w-full h-48 object-cover rounded-xl mb-4 shadow-lg" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x300/eeeeee/888888?text=Foto+Non+Disponibile'; }} />
        <h2 className="text-3xl font-extrabold text-emerald-800 mb-1">{recipe.title}</h2>
        <p className="text-sm font-semibold text-emerald-600 mb-4 border border-emerald-200 inline-block px-3 py-1 rounded-full">{recipe.category}</p>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 border-b pb-1 mb-3">Ingredienti</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-bold text-emerald-700 mb-2 flex items-center"><User size={16} className="mr-1" /> Totali (x{totalPeople})</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                {recipe.ingredients.map((ing, index) => (<li key={index}>{ing.name}: {ing.quantity}{ing.unit}</li>))}
              </ul>
            </div>
            <div>
              <p className="font-bold text-emerald-700 mb-2 flex items-center"><User size={16} className="mr-1" /> Per Persona (x1)</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                {splitIngredients.map((ing, index) => (<li key={index}>{ing.name}: {ing.quantityPerPerson}{ing.unit}</li>))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 border-b pb-1 mb-3">Procedimento</h3>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{recipe.procedure}</p>
        </section>

      </div>
    </div>
  );
};


// Componente Aggiunta Nuova Ricetta (Adattato per usare updateRecipes)
const AddRecipeForm = ({ updateRecipes }) => {
  const [formData, setFormData] = useState({
    title: '', category: categories[0], ingredients: [{ name: '', quantity: '', unit: 'g' }],
    procedure: '', photoUrlInput: '', photoUrl: 'https://placehold.co/100x100/eeeeee/888888?text=Foto+Ricetta',
  });
  const [message, setMessage] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  useEffect(() => {
      const newUrl = formData.photoUrlInput 
          ? formData.photoUrlInput
          : `https://placehold.co/100x100/eeeeee/888888?text=${encodeURIComponent(formData.title || 'Foto Ricetta')}`;
      setFormData(prev => ({ ...prev, photoUrl: newUrl }));
  }, [formData.photoUrlInput, formData.title]);

  const handleIngredientChange = (index, field, value) => {
    const newIngredients = formData.ingredients.map((ing, i) => i === index ? { ...ing, [field]: value } : ing);
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const addIngredient = () => {
    setFormData({ ...formData, ingredients: [...formData.ingredients, { name: '', quantity: '', unit: 'g' }], });
  };

  const removeIngredient = (index) => {
    setFormData({ ...formData, ingredients: formData.ingredients.filter((_, i) => i !== index), });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.procedure || formData.ingredients.some(i => !i.name || !i.quantity)) {
      setMessage('Compila tutti i campi obbligatori (Titolo, Procedimento e Ingredienti).');
      return;
    }

    const newRecipe = {
      id: Date.now(),
      title: formData.title, category: formData.category, photoUrl: formData.photoUrl,
      ingredients: formData.ingredients.map(ing => ({ ...ing, quantity: parseFloat(ing.quantity) || 0, })),
      procedure: formData.procedure,
    };
    
    // Aggiorna lo stato tramite la funzione passata dall'hook, attivando il salvataggio
    updateRecipes(prev => [...prev, newRecipe]); 

    // Reset form
    setFormData({ title: '', category: categories[0], ingredients: [{ name: '', quantity: '', unit: 'g' }], procedure: '', photoUrlInput: '', photoUrl: 'https://placehold.co/100x100/eeeeee/888888?text=Foto+Ricetta', });
    setMessage('Ricetta salvata con successo nel ricettario e sincronizzata!');
  };

  return (
    <div className="p-4 flex-1 overflow-auto">
      <h2 className="text-2xl font-bold text-emerald-800 mb-4">Aggiungi Nuova Ricetta</h2>
      <form onSubmit={handleSubmit} className="space-y-6">

        <div className="border-2 border-dashed border-gray-300 p-6 text-center rounded-xl bg-gray-50">
          <p className="text-sm text-gray-500 mb-2 font-bold">Anteprima Foto Ricetta</p>
          <img src={formData.photoUrl} alt="Anteprima Ricetta" className="w-24 h-24 mx-auto mb-2 rounded-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/eeeeee/888888?text=Errore'; }}/>
          <p className="text-xs text-red-600 font-semibold mt-2">NOTA: L'upload file reale non è supportato in questa demo.</p>
        </div>
        
        <Input label="URL Foto o Testo Placeholder (Es. Pasta)" name="photoUrlInput" value={formData.photoUrlInput} onChange={handleInputChange} placeholder="Incolla un URL o scrivi una parola (Es: Torta)"/>
        <Input label="Titolo Ricetta" name="title" value={formData.title} onChange={handleInputChange} placeholder="Es. Pasta al Pesto" />
        <Select label="Categoria" name="category" value={formData.category} onChange={handleInputChange} options={categories.map(c => ({ label: c }))} />

        <section className="bg-emerald-50 p-4 rounded-xl shadow-inner">
          <h3 className="text-lg font-bold text-emerald-800 mb-3 flex items-center"><ListTodo size={20} className="mr-2" /> Ingredienti e Quantità</h3>
          {formData.ingredients.map((ing, index) => (
            <div key={index} className="flex space-x-2 mb-3 items-end">
              <div className="flex-1"><Input label="Alimento" value={ing.name} onChange={(e) => handleIngredientChange(index, 'name', e.target.value)} placeholder="Nome ingrediente" /></div>
              <div className="w-1/4"><Input label="Qtà" type="number" value={ing.quantity} onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)} placeholder="Qtà" /></div>
              <div className="w-1/4"><Select label="Unità" value={ing.unit} onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)} options={units.map(u => ({ label: u }))} /></div>
              <IconButton icon={X} onClick={() => removeIngredient(index)} className="mb-4" />
            </div>
          ))}
          <button type="button" onClick={addIngredient} className="w-full py-2 border border-emerald-400 text-emerald-600 rounded-lg hover:bg-emerald-100 transition duration-150 text-sm font-medium flex items-center justify-center"> <PlusSquare size={16} className="mr-2" /> Aggiungi Ingrediente </button>
        </section>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Procedimento</label>
          <textarea name="procedure" value={formData.procedure} onChange={handleInputChange} rows="5" placeholder="Descrivi i passaggi per la preparazione..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500" ></textarea>
        </div>

        <Button type="submit"><Save size={20} className="inline mr-2" /> Salva Ricetta</Button>

        {message && (<div className={`p-3 rounded-lg text-sm font-medium ${message.includes('successo') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{message}</div>)}
      </form>
    </div>
  );
};


// Componente Piano Nutrizionista (Adattato per usare updateNutritionistPlan e i toggle)
const NutritionistPlan = ({ plan, updateNutritionistPlan, activeUser, setActiveUser }) => {
  const userPlan = plan[activeUser] || {};
  const [isEditing, setIsEditing] = useState(null); // Contiene la chiave del pasto in modifica
  const [editText, setEditText] = useState('');
  const [openMeal, setOpenMeal] = useState('Colazione'); // Contiene la chiave del pasto aperto (per il toggle)

  const handleToggle = (mealKey) => {
    setOpenMeal(prev => prev === mealKey ? null : mealKey);
  };
  
  // Utilizza una funzione per ottenere il testo completo in modo pulito
  const getFullText = useCallback((items) => {
      // Unisce tutti gli oggetti { text: "..." } in una singola stringa, separati da un salto di riga
      if (!items || items.length === 0) return '';
      // Per questa implementazione, assumiamo che l'array 'items' contenga un solo oggetto { text: "tutto il testo" }
      // o che debbano essere concatenati. L'implementazione attuale memorizza tutto in un unico oggetto text per pasto.
      return items.map(item => item.text).join('\n');
  }, []);


  const handleEditClick = (mealKey) => {
    const currentText = getFullText(userPlan[mealKey]);
    setEditText(currentText);
    setIsEditing(mealKey);
  };
  
  const handleSave = (mealKey) => {
    // Salviamo l'intero blocco di testo come un singolo oggetto nell'array
    const newItems = [{ 
        id: Date.now(), 
        text: editText.trim() // Rimuove spazi vuoti all'inizio/fine
    }];
        
    const newPlan = {
        ...plan,
        [activeUser]: {
            ...plan[activeUser],
            [mealKey]: newItems
        }
    };
    updateNutritionistPlan(newPlan); // Salva su Firebase
    setIsEditing(null);
    setOpenMeal(null); // Chiude il toggle dopo il salvataggio
  };
  
  const handleCancel = () => {
      setIsEditing(null);
      setEditText('');
  };


  return (
    <div className="p-4 flex-1 overflow-auto">
      <h2 className="text-2xl font-bold text-emerald-800 mb-4">Piano Nutrizionista</h2>

      {/* Selezione Utente */}
      <div className="flex justify-around bg-gray-100 p-1 rounded-full mb-6 shadow-inner">
        {['Martina', 'Carmen'].map(user => (
          <button
            key={user}
            onClick={() => setActiveUser(user)}
            className={`flex-1 py-2 text-sm font-semibold rounded-full transition duration-150 ${
              activeUser === user
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <User size={16} className="inline mr-1" /> {user}
          </button>
        ))}
      </div>

      {/* Dettagli Piano (solo per pasto) */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-gray-800 mt-4 mb-3">Indicazioni Generali per {activeUser}</h3>

        {meals.map(mealKey => {
          const items = userPlan[mealKey] || [];
          const mealLabel = mealLabels[mealKey];
          const fullText = getFullText(items); // Ottieni il testo completo da visualizzare
          
          const isCurrentEditing = isEditing === mealKey;
          const isOpen = openMeal === mealKey;

          return (
            <div key={mealKey} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Header della Card/Toggle */}
                <div 
                    className={`p-4 transition duration-200 ${isOpen ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                >
                    <button 
                        onClick={() => handleToggle(mealKey)}
                        className='w-full flex justify-between items-center focus:outline-none'
                    >
                        <p className="text-base font-semibold uppercase text-emerald-700 flex items-center">
                          <Utensils size={16} className="mr-2" /> {mealLabel}
                        </p>
                        {isOpen ? <ChevronUp size={20} className='text-emerald-600'/> : <ChevronDown size={20} className='text-gray-500'/>}
                    </button>
                </div>

                {/* Contenuto Espandibile */}
                {isOpen && (
                    <div className="p-4 border-t border-gray-200">
                        {/* Sezione Modifica */}
                        {isCurrentEditing ? (
                            <div className='bg-emerald-100 p-3 rounded-lg'>
                                <p className='text-sm font-medium text-emerald-800 mb-2'>Modifica indicazioni (testo libero):</p>
                                <textarea 
                                    value={editText} 
                                    onChange={(e) => setEditText(e.target.value)} 
                                    rows="5" 
                                    placeholder="Inserisci qui tutte le indicazioni della nutrizionista, anche su più righe..." 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm" 
                                ></textarea>
                                <div className='flex justify-end space-x-2 mt-2'>
                                    <button onClick={handleCancel} className='px-3 py-1 text-xs text-red-600 bg-white border border-red-300 hover:bg-red-50 rounded-lg'><X size={14} className='inline'/> Annulla</button>
                                    <button onClick={() => handleSave(mealKey)} className='px-3 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg'><Save size={14} className='inline'/> Salva</button>
                                </div>
                            </div>
                        ) : (
                            // Sezione Visualizzazione (Testo libero)
                            <>
                                {fullText.length > 0 ? (
                                    // Utilizziamo whitespace-pre-wrap per rispettare i salti di riga
                                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                      {fullText}
                                    </p>
                                ) : (
                                    <p className="text-gray-500 italic text-sm text-center py-2">Nessuna indicazione. Aggiungi le note della nutrizionista.</p>
                                )}
                                
                                <div className='flex justify-end mt-4'>
                                    <button 
                                        onClick={() => handleEditClick(mealKey)} 
                                        className='px-3 py-1 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center'
                                    >
                                        <Edit size={16} className='inline mr-1'/> {fullText.length > 0 ? 'Modifica' : 'Aggiungi'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


// --- App Principale ---

const App = () => {
  const { isLoading, userId, dataState, updateRecipes, updateWeeklyPlan, updateNutritionistPlan } = useFirebaseApp();
  const [activeTab, setActiveTab] = useState('Planner');
  const [activeUser, setActiveUser] = useState('Martina');
  const [activeWeek, setActiveWeek] = useState(Object.keys(dataState.weeklyPlan)[0]);
  
  const { recipes, weeklyPlan, nutritionistPlan } = dataState;

  // Se i dati stanno ancora caricando, mostriamo un caricamento
  if (isLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="w-full max-w-md h-screen flex flex-col items-center justify-center bg-white shadow-xl">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
                  <p className="mt-4 text-gray-700 font-semibold">Caricamento dati sincronizzati...</p>
              </div>
          </div>
      );
  }

  // Logica di rendering del contenuto
  let content;
  switch (activeTab) {
    case 'Planner':
      content = (
          <WeeklyPlanner 
              weeklyPlan={weeklyPlan} 
              updateWeeklyPlan={updateWeeklyPlan} 
              recipes={recipes} 
              activeWeek={activeWeek}
              setActiveWeek={setActiveWeek}
          />
      );
      break;
    case 'Ricettario':
      content = <RecipeBook recipes={recipes} updateRecipes={updateRecipes} />;
      break;
    case 'Aggiungi':
      content = <AddRecipeForm updateRecipes={updateRecipes} />;
      break;
    case 'Nutrizionista':
      content = (
          <NutritionistPlan 
              plan={nutritionistPlan} 
              updateNutritionistPlan={updateNutritionistPlan}
              activeUser={activeUser} 
              setActiveUser={setActiveUser} 
          />
      );
      break;
    default:
      content = <WeeklyPlanner weeklyPlan={weeklyPlan} updateWeeklyPlan={updateWeeklyPlan} recipes={recipes} activeWeek={activeWeek} setActiveWeek={setActiveWeek} />;
  }

  const navItems = [
    { name: 'Planner', icon: CalendarDays },
    { name: 'Ricettario', icon: ChefHat },
    { name: 'Aggiungi', icon: PlusSquare },
    { name: 'Nutrizionista', icon: ListTodo },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-0">
      <div className="w-full max-w-md h-screen bg-white shadow-xl flex flex-col">
        {/* Header/Status Bar */}
        <header className="p-4 pt-8 bg-emerald-600 text-white shadow-lg flex justify-between items-center">
            <h1 className="text-xl font-bold">Food Planner Sincronizzato</h1>
            <div className="flex flex-col items-end">
                <span className="text-xs">Utente ID (Accesso):</span>
                <span className="text-xs font-mono truncate max-w-[100px]">{userId}</span>
            </div>
        </header>

        {/* Contenuto della Sezione Attiva */}
        <main className="flex-1 overflow-y-auto pb-4">
          {content}
        </main>

        {/* Navigazione Bottom Bar */}
        <nav className="border-t border-gray-200 bg-white shadow-2xl p-2 sticky bottom-0">
          <div className="flex justify-around">
            {navItems.map(item => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`flex flex-col items-center p-2 rounded-xl transition duration-200 ${
                  activeTab === item.name
                    ? 'text-emerald-600 font-bold bg-emerald-50'
                    : 'text-gray-500 hover:text-emerald-600'
                }`}
              >
                <item.icon size={24} />
                <span className="text-xs mt-1">{item.name}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default App;