import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Shield, UserPlus, Search, Edit3, Trash2, Lock, Unlock, X, CheckCircle, AlertTriangle, Camera, Filter } from 'lucide-react';

const getEnvVar = (key, fallback) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {
    // Ignore error if import.meta is unavailable
  }
  return fallback;
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', 'AIzaSyDummyKey'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', 'apsinian-db.firebaseapp.com'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', 'apsinian-db'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', 'apsinian-db.appspot.com'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456789'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', '1:123:web:abc')
};

let db = null;
try {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase failed to initialize, using local mode.");
}

const LOCAL_STORAGE_KEY = 'apsinian_members_fallback';

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [accessPasswordInput, setAccessPasswordInput] = useState('');
  const [accessError, setAccessError] = useState(false);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodFilter, setBloodFilter] = useState('ALL');
  const [isUsingLocal, setIsUsingLocal] = useState(false);
  
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    bloodType: 'NA',
    yearSurvive: '',
    activeContact: '',
    currentAddress: '',
    mobile: '',
    photo: ''
  });

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchMembers();
    }
  }, [isUnlocked]);

  const handleAccessSubmit = (e) => {
    e.preventDefault();
    if (accessPasswordInput === 'apsinianunity') {
      setIsUnlocked(true);
      setAccessError(false);
      showToast("Access granted successfully!");
    } else {
      setAccessError(true);
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const projId = getEnvVar('VITE_FIREBASE_PROJECT_ID', '');
      if (!projId || !db) {
        throw new Error("No Firebase config");
      }
      const querySnapshot = await getDocs(collection(db, 'members'));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembers(items);
      setIsUsingLocal(false);
    } catch (error) {
      console.log("Switching to Local Storage mode.");
      setIsUsingLocal(true);
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        setMembers(JSON.parse(saved));
      } else {
        const sample = [{
          id: '1',
          name: 'Juan Dela Cruz',
          dob: '1995-05-15',
          bloodType: 'O+',
          yearSurvive: '2020',
          activeContact: 'juan@example.com',
          currentAddress: 'Cebu City, Philippines',
          mobile: '09123456789',
          photo: ''
        }];
        setMembers(sample);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sample));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === 'apsinian_admin') {
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminPassword('');
      showToast("Admin access enabled successfully!");
    } else {
      showToast("Incorrect secret password!", "error");
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setFormData(prev => ({ ...prev, photo: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    
    const phMobileRegex = /^(09|\+639)\d{9}$/;
    if (!phMobileRegex.test(formData.mobile)) {
      showToast("Please enter a valid PH mobile number (e.g., 09123456789 or +639123456789)", "error");
      return;
    }

    const isEdit = !!editingId;
    setConfirmConfig({
      isOpen: true,
      title: isEdit ? "Confirm Update Record" : "Confirm Add New Record",
      message: `Are you sure you want to ${isEdit ? 'update' : 'add'} records for ${formData.name}?`,
      onConfirm: executeSave
    });
  };

  const executeSave = async () => {
    try {
      if (!isUsingLocal && db) {
        if (editingId) {
          const docRef = doc(db, 'members', editingId);
          await updateDoc(docRef, formData);
          setMembers(members.map(m => m.id === editingId ? { id: editingId, ...formData } : m));
        } else {
          const docRef = await addDoc(collection(db, 'members'), formData);
          setMembers([...members, { id: docRef.id, ...formData }]);
        }
      } else {
        let updatedList;
        if (editingId) {
          updatedList = members.map(m => m.id === editingId ? { id: editingId, ...formData } : m);
        } else {
          const newId = Date.now().toString();
          updatedList = [...members, { id: newId, ...formData }];
        }
        setMembers(updatedList);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
      }
      
      showToast(editingId ? "Record updated successfully!" : "New member added successfully!");
      setShowFormModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving record:", error);
      showToast("Error saving record", "error");
    } finally {
      setConfirmConfig({ isOpen: false });
    }
  };

  const handleDeleteClick = (id, name) => {
    setConfirmConfig({
      isOpen: true,
      title: "Confirm Delete Record",
      message: `Are you sure you want to delete ${name}? This action cannot be undone.`,
      onConfirm: () => executeDelete(id)
    });
  };

  const executeDelete = async (id) => {
    try {
      if (!isUsingLocal && db) {
        await deleteDoc(doc(db, 'members', id));
      }
      const updatedList = members.filter(m => m.id !== id);
      setMembers(updatedList);
      if (isUsingLocal) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
      }
      showToast("Record deleted successfully!");
    } catch (error) {
      console.error("Error deleting record:", error);
      showToast("Error deleting record", "error");
    } finally {
      setConfirmConfig({ isOpen: false });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      dob: '',
      bloodType: 'NA',
      yearSurvive: '',
      activeContact: '',
      currentAddress: '',
      mobile: '',
      photo: ''
    });
    setEditingId(null);
  };

  const openEditModal = (member) => {
    if (!isAdmin) {
      setShowAdminModal(true);
      return;
    }
    setEditingId(member.id);
    setFormData({
      name: member.name || '',
      dob: member.dob || '',
      bloodType: member.bloodType || 'NA',
      yearSurvive: member.yearSurvive || '',
      activeContact: member.activeContact || '',
      currentAddress: member.currentAddress || '',
      mobile: member.mobile || '',
      photo: member.photo || ''
    });
    setShowFormModal(true);
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = 
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.currentAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.mobile?.includes(searchTerm);

    const matchesBlood = bloodFilter === 'ALL' || m.bloodType === bloodFilter;

    return matchesSearch && matchesBlood;
  });

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
            <Shield size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Apsinian Beta Chapter</h2>
          <p className="text-xs text-slate-500 mb-6">Enter secret passcode (`apsinianunity`) to access database</p>
          
          <form onSubmit={handleAccessSubmit} className="space-y-4">
            <input 
              type="password" 
              required
              placeholder="Enter passcode..."
              value={accessPasswordInput}
              onChange={(e) => setAccessPasswordInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-center font-mono tracking-widest"
              autoFocus
            />
            {accessError && (
              <p className="text-xs text-rose-500 font-medium">Incorrect secret passcode. Try again.</p>
            )}
            <button 
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow transition"
            >
              Access Database
            </button>
          </form>
          <p className="text-[11px] text-slate-400 mt-6">&copy; 2026 Apsinian Beta Chapter. Secure Records System.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-12">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-white font-medium flex items-center gap-2 transition-all ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          {toast.message}
        </div>
      )}

      <header className="bg-indigo-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide flex items-center gap-2">
              <Shield className="text-indigo-400" /> Apsinian Beta Chapter
            </h1>
            <p className="text-indigo-200 text-sm mt-1">Members Database & Directory</p>
          </div>
          
          <div className="flex items-center gap-3">
            {isAdmin ? (
              <div className="flex items-center gap-2 bg-emerald-700/80 px-3 py-1.5 rounded-lg text-sm font-medium">
                <Unlock size={16} /> Admin Mode Active
                <button onClick={() => setIsAdmin(false)} className="ml-2 text-xs underline text-emerald-200 hover:text-white">Lock</button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAdminModal(true)}
                className="flex items-center gap-1.5 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 px-3 py-1.5 rounded-lg text-sm font-medium border border-indigo-700 transition"
              >
                <Lock size={16} /> Admin Login
              </button>
            )}

            <button 
              onClick={() => { resetForm(); setShowFormModal(true); }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium shadow transition"
            >
              <UserPlus size={18} /> Add Member
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, address, or mobile..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select
                value={bloodFilter}
                onChange={(e) => setBloodFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Blood Types</option>
                <option value="NA">NA</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            <div className="text-sm text-slate-500 flex items-center gap-2">
              <span>Total: <strong className="text-slate-800">{filteredMembers.length}</strong></span>
              {isUsingLocal && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Local</span>}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500 font-medium">Loading database records...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-100">
            <p className="text-slate-500 font-medium">No member records found.</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your search or blood type filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map(member => (
              <div key={member.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden border border-slate-300 flex items-center justify-center">
                      {member.photo ? (
                        <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-slate-500">{member.name?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-slate-900 truncate">{member.name}</h3>
                      <p className="text-xs text-indigo-600 font-semibold mt-0.5">Blood Type: {member.bloodType || 'NA'}</p>
                      <p className="text-xs text-slate-500 mt-1">Year Survive: <span className="font-medium text-slate-700">{member.yearSurvive || 'N/A'}</span></p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 text-sm border-t border-slate-100 pt-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">DOB:</span>
                      <span className="font-medium text-slate-700">{member.dob || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Mobile:</span>
                      <span className="font-medium text-slate-700">{member.mobile}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Contact:</span>
                      <span className="font-medium text-slate-700 truncate max-w-[180px]">{member.activeContact}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">Address:</span>
                      <span className="text-slate-700 text-xs line-clamp-2">{member.currentAddress}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
                  <button 
                    onClick={() => openEditModal(member)}
                    className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded font-medium transition"
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => handleDeleteClick(member.id, member.name)}
                      className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded font-medium transition"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Lock size={20} className="text-indigo-600" /> Admin Authentication
            </h3>
            <p className="text-xs text-slate-500 mb-4">Enter secret admin password (`apsinian_admin`) to unlock Edit and Delete functions.</p>
            
            <form onSubmit={handleAdminLogin}>
              <input 
                type="password" 
                placeholder="Enter secret password" 
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Member Record' : 'Add New Member'}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g., Juan Dela Cruz"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth</label>
                  <input 
                    type="date" 
                    required
                    value={formData.dob}
                    onChange={(e) => setFormData({...formData, dob: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Blood Type</label>
                  <select
                    value={formData.bloodType}
                    onChange={(e) => setFormData({...formData, bloodType: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="NA">NA (Not Sure)</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Year Survive</label>
                <input 
                  type="text" 
                  placeholder="e.g., 2020 or Batch 2018"
                  value={formData.yearSurvive}
                  onChange={(e) => setFormData({...formData, yearSurvive: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Active Mobile (PH Number)</label>
                <input 
                  type="text" 
                  required
                  placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                  value={formData.mobile}
                  onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Active Contact (Email / Social Link)</label>
                <input 
                  type="text" 
                  required
                  placeholder="email@example.com or fb.com/username"
                  value={formData.activeContact}
                  onChange={(e) => setFormData({...formData, activeContact: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Current Address</label>
                <textarea 
                  required
                  rows="2"
                  value={formData.currentAddress}
                  onChange={(e) => setFormData({...formData, currentAddress: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Street, Barangay, City/Province"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Member Picture (Auto-compressed)</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 flex items-center gap-1 transition">
                    <Camera size={14} /> Upload Image
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {formData.photo && <span className="text-xs text-emerald-600 font-medium">Image attached</span>}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow"
                >
                  {editingId ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmConfig.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{confirmConfig.title}</h3>
            <p className="text-sm text-slate-600 mb-6">{confirmConfig.message}</p>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setConfirmConfig({ isOpen: false })}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={confirmConfig.onConfirm}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
