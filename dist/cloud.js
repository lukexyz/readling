import {FIREBASE} from './cloud-config.js';
// Keeps a copy of the album in the signed-in grown-up's Google account, using Firebase sign-in and one
// Firestore document for each account. The Google libraries are fetched only once someone has signed in
// on this device or is about to, so the game opens as quickly as before and still plays offline.
const SDK='https://www.gstatic.com/firebasejs/13.2.0/firebase-';
const SIGNED_IN='readling.wordwoods.signed-in';
let linked=null;
function link() {
  return linked ||= Promise.all(['app','auth','firestore-lite'].map(part=>import(SDK+part+'.js'))).then(([{initializeApp},auth,store])=>{
    const app=initializeApp(FIREBASE);
    return {auth,store,session:auth.getAuth(app),db:store.getFirestore(app)};
  }).catch(e=>{linked=null;throw e;});
}
async function savedAlbum() {
  const {store,session,db}=await link();
  return {store,ref:store.doc(db,'albums',session.currentUser.uid)};
}
const cloud={
  on:!!FIREBASE,
  // Whether someone signed in on this device before, which the game can ask without fetching anything.
  remembered() {
    try {return !!localStorage.getItem(SIGNED_IN);} catch {return false;}
  },
  // Calls change with {email} when someone is signed in and null when nobody is, now and whenever it changes.
  async watch(change) {
    const {auth,session}=await link();
    auth.onAuthStateChanged(session,user=>{
      try {user?localStorage.setItem(SIGNED_IN,'1'):localStorage.removeItem(SIGNED_IN);} catch { /* Signing in still works for this visit. */ }
      change(user && {email:user.email || ''});
    });
  },
  async signIn() {
    const {auth,session}=await link();
    const google=new auth.GoogleAuthProvider();
    // Always show the account chooser, so one stray tap from a child cannot sign in by itself.
    google.setCustomParameters({prompt:'select_account'});
    await auth.signInWithPopup(session,google);
  },
  async signOut() {
    const {auth,session}=await link();
    await auth.signOut(session);
  },
  // The saved copy as packed by packAlbum in game.js, or null when this account has none yet.
  async load() {
    const {store,ref}=await savedAlbum();
    const saved=await store.getDoc(ref);
    return saved.exists()?saved.data().album:null;
  },
  async save(album) {
    const {store,ref}=await savedAlbum();
    await store.setDoc(ref,{album,saved:Date.now()});
  }
};
export {cloud};
