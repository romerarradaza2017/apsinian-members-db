import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Shield, UserPlus, Search, Edit3, Trash2, Lock, Unlock, X, CheckCircle, AlertTriangle, Camera, Filter, Calendar, CheckSquare, Image as ImageIcon, Eye, BarChart3, Clock, CheckCircle2, RefreshCw } from 'lucide-react';

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

const LOCAL_STORAGE_MEMBERS = 'apsinian_members_fallback';
const LOCAL_STORAGE_ACTIVITIES = 'apsinian_activities_fallback';

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [accessPasswordInput, setAccessPasswordInput] = useState('');
  const [accessError, setAccessError] = useState(false);

  const [activeTab, setActiveTab] = useState('members'); // 'members', 'activities', or 'dashboard'

  const [members, setMembers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodFilter, setBloodFilter] = useState('ALL');
  
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [selectedActivity, setSelectedActivity] = useState(null);

  const [isUsingLocal, setIsUsingLocal] = useState(false);
  
  // Member Form State
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

  // Activity Form State
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [activityData, setActivityData] = useState({
    title: '',
    targetDate: '',
    description: '',
    photos: [], // array of base64 strings (max 5)
    accomplished: false
  });

  // Full Screen Image Lightbox State
  const [fullscreenImage, setFullscreenImage] = useState(null);

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
      fetchAllData();
    }
  }, [isUnlocked]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const projId = getEnvVar('VITE_FIREBASE_PROJECT_ID', '');
      if (!projId || !db) {
        throw new Error("No Firebase config");
      }
      
      const memberSnapshot = await getDocs(collection(db, 'members'));
      const memberItems = memberSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembers(memberItems);

      const activitySnapshot = await getDocs(collection(db, 'activities'));
      const activityItems = activitySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivities(activityItems);

      setIsUsingLocal(false);
      showToast("Database successfully refreshed!");
    } catch (error) {
      console.log("Switching to Local Storage mode.");
      setIsUsingLocal(true);
      
      const savedMembers = localStorage.getItem(LOCAL_STORAGE_MEMBERS);
      if (savedMembers) {
        setMembers(JSON.parse(savedMembers));
      } else {
        const sampleMembers = [{
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
        setMembers(sampleMembers);
        localStorage.setItem(LOCAL_STORAGE_MEMBERS, JSON.stringify(sampleMembers));
      }

      const savedActivities = localStorage.getItem(LOCAL_STORAGE_ACTIVITIES);
      if (savedActivities) {
        setActivities(JSON.parse(savedActivities));
      } else {
        const sampleActivities = [{
          id: 'act-1',
          title: 'Annual Coastal Cleanup Drive',
          targetDate: '2026-08-15',
          description: 'Gathering all chapter members for environmental coastal cleaning in Mactan.',
          photos: [],
          accomplished: false
        }];
        setActivities(sampleActivities);
        localStorage.setItem(LOCAL_STORAGE_ACTIVITIES, JSON.stringify(sampleActivities));
      }
      showToast("Refreshed from local memory!");
    } finally {
      setLoading(false);
    }
  };

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

  const compressImageFile = (file, callback) => {
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
        callback(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleMemberImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    compressImageFile(file, (dataUrl) => {
      setFormData(prev => ({ ...prev, photo: dataUrl }));
    });
  };

  const handleActivityMultipleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const currentCount = activityData.photos.length;
    const remainingSlots = 5 - currentCount;
    if (remainingSlots <= 0) {
      showToast("Maximum of 5 photos allowed per activity.", "error");
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    filesToProcess.forEach(file => {
      compressImageFile(file, (dataUrl) => {
        setActivityData(prev => {
          if (prev.photos.length >= 5) return prev;
          return { ...prev, photos: [...prev.photos, dataUrl] };
        });
      });
    });
  };

  const removeActivityPhoto = (index) => {
    setActivityData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const calculateAge = (dobString) => {
    if (!dobString) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return isNaN(age) ? 'N/A' : `${age} yrs old`;
  };

  const handleSubmitMemberForm = (e) => {
    e.preventDefault();
    const phMobileRegex = /^(09|\+639)\d{9}$/;
    if (!phMobileRegex.test(formData.mobile)) {
      showToast("Please enter a valid PH mobile number (e.g., 09123456789)", "error");
      return;
    }

    const isEdit = !!editingId;
    setConfirmConfig({
      isOpen: true,
      title: isEdit ? "Confirm Update Record" : "Confirm Add New Record",
      message: `Are you sure you want to ${isEdit ? 'update' : 'add'} records for ${formData.name}?`,
      onConfirm: executeSaveMember
    });
  };

  const executeSaveMember = async () => {
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
        localStorage.setItem(LOCAL_STORAGE_MEMBERS, JSON.stringify(updatedList));
      }
      
      showToast(editingId ? "Member record successfully updated!" : "Member successfully added!");
      setShowFormModal(false);
      resetMemberForm();
    } catch (error) {
      console.error("Error saving member:", error);
      showToast("Error saving record", "error");
    } finally {
      setConfirmConfig({ isOpen: false });
    }
  };

  const handleDeleteMemberClick = (id, name) => {
    setConfirmConfig({
      isOpen: true,
      title: "Confirm Delete Record",
      message: `Are you sure you want to delete ${name}? This action cannot be undone.`,
      onConfirm: () => executeDeleteMember(id)
    });
  };

  const executeDeleteMember = async (id) => {
    try {
      if (!isUsingLocal && db) {
        await deleteDoc(doc(db, 'members', id));
      }
      const updatedList = members.filter(m => m.id !== id);
      setMembers(updatedList);
      if (isUsingLocal) {
        localStorage.setItem(LOCAL_STORAGE_MEMBERS, JSON.stringify(updatedList));
      }
      showToast("Member record successfully deleted!");
    } catch (error) {
      console.error("Error deleting member:", error);
      showToast("Error deleting record", "error");
    } finally {
      setConfirmConfig({ isOpen: false });
    }
  };

  const resetMemberForm = () => {
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

  const openEditMemberModal = (member) => {
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

  const handleSubmitActivityForm = (e) => {
    e.preventDefault();
    const isEdit = !!editingActivityId;
    setConfirmConfig({
      isOpen: true,
      title: isEdit ? "Confirm Update Activity" : "Confirm Add New Activity",
      message: `Are you sure you want to ${isEdit ? 'update' : 'add'} activity "${activityData.title}"?`,
      onConfirm: executeSaveActivity
    });
  };

  const executeSaveActivity = async () => {
    try {
      if (!isUsingLocal && db) {
        if (editingActivityId) {
          const docRef = doc(db, 'activities', editingActivityId);
          await updateDoc(docRef, activityData);
          setActivities(activities.map(a => a.id === editingActivityId ? { id: editingActivityId, ...activityData } : a));
        } else {
          const docRef = await addDoc(collection(db, 'activities'), activityData);
          setActivities([...activities, { id: docRef.id, ...activityData }]);
        }
      } else {
        let updatedList;
        if (editingActivityId) {
          updatedList = activities.map(a => a.id === editingActivityId ? { id: editingActivityId, ...activityData } : a);
        } else {
          const newId = 'act-' + Date.now();
          updatedList = [...activities, { id: newId, ...activityData }];
        }
        setActivities(updatedList);
        localStorage.setItem(LOCAL_STORAGE_ACTIVITIES, JSON.stringify(updatedList));
      }
      
      showToast(editingActivityId ? "Activity successfully updated!" : "Activity successfully added!");
      setShowActivityModal(false);
      resetActivityForm();
    } catch (error) {
      console.error("Error saving activity:", error);
      showToast("Error saving activity", "error");
    } finally {
      setConfirmConfig({ isOpen: false });
    }
  };

  const handleToggleAccomplished = async (activity) => {
    if (!isAdmin) {
      setShowAdminModal(true);
      return;
    }
    const updatedStatus = !activity.accomplished;
    try {
      if (!isUsingLocal && db) {
        const docRef = doc(db, 'activities', activity.id);
        await updateDoc(docRef, { accomplished: updatedStatus });
      }
      const updatedList = activities.map(a => a.id === activity.id ? { ...a, accomplished: updatedStatus } : a);
      setActivities(updatedList);
      if (isUsingLocal) {
        localStorage.setItem(LOCAL_STORAGE_ACTIVITIES, JSON.stringify(updatedList));
      }
      showToast(updatedStatus ? "Activity marked as Accomplished!" : "Activity marked as Pending.");
    } catch (error) {
      console.error("Error updating accomplishment status:", error);
      showToast("Error updating status", "error");
    }
  };

  const handleDeleteActivityClick = (id, title) => {
    setConfirmConfig({
      isOpen: true,
      title: "Confirm Delete Activity",
      message: `Are you sure you want to delete activity "${title}"?`,
      onConfirm: () => executeDeleteActivity(id)
    });
  };

  const executeDeleteActivity = async (id) => {
    try {
      if (!isUsingLocal && db) {
        await deleteDoc(doc(db, 'activities', id));
      }
      const updatedList = activities.filter(a => a.id !== id);
      setActivities(updatedList);
      if (isUsingLocal) {
        localStorage.setItem(LOCAL_STORAGE_ACTIVITIES, JSON.stringify(updatedList));
      }
      showToast("Activity successfully deleted!");
    } catch (error) {
      console.error("Error deleting activity:", error);
      showToast("Error deleting activity", "error");
    } finally {
      setConfirmConfig({ isOpen: false });
    }
  };

  const resetActivityForm = () => {
    setActivityData({
      title: '',
      targetDate: '',
      description: '',
      photos: [],
      accomplished: false
    });
    setEditingActivityId(null);
  };

  const openEditActivityModal = (act) => {
    if (!isAdmin) {
      setShowAdminModal(true);
      return;
    }
    setEditingActivityId(act.id);
    setActivityData({
      title: act.title || '',
      targetDate: act.targetDate || '',
      description: act.description || '',
      photos: act.photos || [],
      accomplished: !!act.accomplished
    });
    setShowActivityModal(true);
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = 
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.currentAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.mobile?.includes(searchTerm);
    const matchesBlood = bloodFilter === 'ALL' || m.bloodType === bloodFilter;
    return matchesSearch && matchesBlood;
  });

  const filteredActivities = activities.filter(a =>
    a.title?.toLowerCase().includes(activitySearchTerm.toLowerCase()) ||
    a.description?.toLowerCase().includes(activitySearchTerm.toLowerCase()) ||
    a.targetDate?.includes(activitySearchTerm)
  );

  // Dashboard calculations for activities
  const totalActivities = activities.length;
  const accomplishedActivities = activities.filter(a => a.accomplished).length;
  const accomplishedPercentage = totalActivities > 0 ? Math.round((accomplishedActivities / totalActivities) * 100) : 0;

  // Group activities per month and year (based on targetDate YYYY-MM-DD)
  const activitiesByMonthYear = {};
  activities.forEach(a => {
    if (!a.targetDate) return;
    const dateObj = new Date(a.targetDate);
    if (isNaN(dateObj.getTime())) return;
    const monthName = dateObj.toLocaleString('default', { month: 'long' });
    const year = dateObj.getFullYear();
    const key = `${monthName} ${year}`;
    activitiesByMonthYear[key] = (activitiesByMonthYear[key] || 0) + 1;
  });

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
            <Shield size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Apsinian Beta Chapter</h2>
          <p className="text-xs text-slate-500 mb-6">Enter secret passcode to access database</p>
          
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
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-white font-medium flex items-center gap-2 transition-all bg-emerald-600">
          <CheckCircle size={20} />
          {toast.message}
        </div>
      )}

      {/* Full Screen Image Lightbox */}
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setFullscreenImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <button onClick={() => setFullscreenImage(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300 text-xl font-bold">
              <X size={28} />
            </button>
            <img src={fullscreenImage} alt="Fullscreen preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}

      {/* Activity Details Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8">
            <button onClick={() => setSelectedActivity(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={22} />
            </button>

            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 ${selectedActivity.accomplished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {selectedActivity.accomplished ? 'Accomplished' : 'Pending'}
            </span>

            <h2 className="text-xl font-bold text-slate-900">{selectedActivity.title}</h2>
            <p className="text-xs text-indigo-600 font-semibold mt-1 flex items-center gap-1">
              <Calendar size={14} /> Target Date: {selectedActivity.targetDate || 'TBD'}
            </p>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</h4>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedActivity.description}</p>
            </div>

            {selectedActivity.photos && selectedActivity.photos.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Attached Photos ({selectedActivity.photos.length}/5)</h4>
                <div className="grid grid-cols-3 gap-2">
                  {selectedActivity.photos.map((pUrl, idx) => (
                    <div key={idx} className="h-24 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer relative group" onClick={() => setFullscreenImage(pUrl)}>
                      <img src={pUrl} alt="Activity" className="w-full h-full object-cover group-hover:scale-105 transition" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <Eye size={18} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedActivity(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg text-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-indigo-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide flex items-center gap-2">
              <Shield className="text-indigo-400" /> Apsinian Beta Chapter
            </h1>
            <p className="text-indigo-200 text-sm mt-1">Members Database & Chapter Activities Directory</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              onClick={fetchAllData}
              title="Refresh database records"
              className="flex items-center gap-1.5 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 px-3 py-1.5 rounded-lg text-sm font-medium border border-indigo-700 transition"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Data
            </button>

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

            {activeTab === 'members' ? (
              <button 
                onClick={() => { resetMemberForm(); setShowFormModal(true); }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium shadow transition"
              >
                <UserPlus size={18} /> Add Member
              </button>
            ) : activeTab === 'activities' ? (
              <button 
                onClick={() => { resetActivityForm(); setShowActivityModal(true); }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium shadow transition"
              >
                <Calendar size={18} /> Add Activity
              </button>
            ) : null}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex border-t border-indigo-800/60 gap-6">
          <button 
            onClick={() => setActiveTab('members')}
            className={`py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${activeTab === 'members' ? 'border-amber-400 text-amber-300' : 'border-transparent text-indigo-200 hover:text-white'}`}
          >
            <Shield size={16} /> Members Directory ({members.length})
          </button>
          <button 
            onClick={() => setActiveTab('activities')}
            className={`py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${activeTab === 'activities' ? 'border-amber-400 text-amber-300' : 'border-transparent text-indigo-200 hover:text-white'}`}
          >
            <Calendar size={16} /> Chapter Activities ({activities.length})
          </button>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${activeTab === 'dashboard' ? 'border-amber-400 text-amber-300' : 'border-transparent text-indigo-200 hover:text-white'}`}
          >
            <BarChart3 size={16} /> Activities Dashboard
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 mt-8">
        {activeTab === 'members' ? (
          <div>
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
                        <div className="w-16 h-16 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden border border-slate-300 flex items-center justify-center cursor-pointer" onClick={() => member.photo && setFullscreenImage(member.photo)}>
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
                          <span className="text-slate-400 text-xs">Age / DOB:</span>
                          <span className="font-medium text-slate-700">{calculateAge(member.dob)} ({member.dob || 'N/A'})</span>
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
                        onClick={() => openEditMemberModal(member)}
                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded font-medium transition"
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={() => handleDeleteMemberClick(member.id, member.name)}
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
          </div>
        ) : activeTab === 'activities' ? (
          <div>
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search activities by title or description..." 
                  value={activitySearchTerm}
                  onChange={(e) => setActivitySearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                <span className="text-sm text-slate-500">Total Activities: <strong className="text-slate-800">{filteredActivities.length}</strong></span>
                <button 
                  onClick={() => { resetActivityForm(); setShowActivityModal(true); }}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium text-sm shadow transition"
                >
                  <Calendar size={16} /> Add Activity
                </button>
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-100">
                <p className="text-slate-500 font-medium">No chapter activities found.</p>
                <p className="text-slate-400 text-sm mt-1">Try adjusting your search query or click "Add Activity".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredActivities.map(act => (
                  <div key={act.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                    <div className="p-5 cursor-pointer" onClick={() => setSelectedActivity(act)}>
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h3 className="font-bold text-lg text-slate-900 hover:text-indigo-600 transition">{act.title}</h3>
                          <p className="text-xs text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                            <Calendar size={14} /> Target Date: {act.targetDate || 'TBD'}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${act.accomplished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {act.accomplished ? 'Accomplished' : 'Pending'}
                        </span>
                      </div>

                      <p className="text-sm text-slate-600 mt-3 line-clamp-2">{act.description}</p>

                      {act.photos && act.photos.length > 0 && (
                        <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                          <p className="text-xs font-semibold text-slate-500 mb-2">Attached Photos ({act.photos.length}/5):</p>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {act.photos.map((pUrl, idx) => (
                              <div key={idx} className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 cursor-pointer relative group" onClick={() => setFullscreenImage(pUrl)}>
                                <img src={pUrl} alt="Activity" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                  <Eye size={16} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-between items-center">
                      <button 
                        onClick={() => handleToggleAccomplished(act)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${act.accomplished ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                      >
                        <CheckSquare size={14} /> {act.accomplished ? 'Mark as Pending' : 'Mark Accomplished'}
                      </button>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => openEditActivityModal(act)}
                          className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded font-medium transition"
                        >
                          <Edit3 size={14} /> Edit
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteActivityClick(act.id, act.title)}
                            className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded font-medium transition"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="text-indigo-600" /> Chapter Activities Performance Dashboard
            </h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Accomplished Rate</p>
                  <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{accomplishedPercentage}%</h3>
                  <p className="text-xs text-slate-500 mt-1">{accomplishedActivities} of {totalActivities} activities completed</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl">
                  <CheckCircle2 size={28} />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Planned</p>
                  <h3 className="text-3xl font-extrabold text-indigo-600 mt-1">{totalActivities}</h3>
                  <p className="text-xs text-slate-500 mt-1">Total chapter events scheduled</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl">
                  <Calendar size={28} />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Activities</p>
                  <h3 className="text-3xl font-extrabold text-amber-600 mt-1">{totalActivities - accomplishedActivities}</h3>
                  <p className="text-xs text-slate-500 mt-1">Activities yet to be accomplished</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl">
                  <Clock size={28} />
                </div>
              </div>
            </div>

            {/* Activities Breakdown Per Month and Year */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-lg text-slate-900 mb-4">Activities Breakdown per Month & Year</h3>
              {Object.keys(activitiesByMonthYear).length === 0 ? (
                <p className="text-sm text-slate-500">No scheduled activities with valid target dates yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(activitiesByMonthYear).map(([period, count]) => (
                    <div key={period} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                      <span className="font-medium text-slate-700 text-sm flex items-center gap-2">
                        <Calendar size={16} className="text-indigo-600" /> {period}
                      </span>
                      <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold">
                        {count} {count === 1 ? 'activity' : 'activities'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Admin Login Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Lock size={20} className="text-indigo-600" /> Admin Authentication
            </h3>
            <p className="text-xs text-slate-500 mb-4">Enter secret admin password to unlock Edit, Delete, and Accomplish actions.</p>
            
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

      {/* Member Form Modal */}
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

            <form onSubmit={handleSubmitMemberForm} className="space-y-4">
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
                    <input type="file" accept="image/*" onChange={handleMemberImageUpload} className="hidden" />
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

      {/* Activity Form Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingActivityId ? 'Edit Chapter Activity' : 'Add New Chapter Activity'}
              </h3>
              <button onClick={() => setShowActivityModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitActivityForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Activity Title</label>
                <input 
                  type="text" 
                  required
                  value={activityData.title}
                  onChange={(e) => setActivityData({...activityData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g., Annual Coastal Cleanup"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Date</label>
                <input 
                  type="date" 
                  required
                  value={activityData.targetDate}
                  onChange={(e) => setActivityData({...activityData, targetDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea 
                  required
                  rows="3"
                  value={activityData.description}
                  onChange={(e) => setActivityData({...activityData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Details about the chapter activity..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Activity Photos (Max 5, Auto-compressed: {activityData.photos.length}/5)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {activityData.photos.map((pUrl, idx) => (
                    <div key={idx} className="w-16 h-16 rounded-lg relative border border-slate-200 overflow-hidden group">
                      <img src={pUrl} alt="Upload preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => removeActivityPhoto(idx)}
                        className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 text-xs opacity-80 hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                {activityData.photos.length < 5 && (
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 inline-flex items-center gap-1 transition">
                    <ImageIcon size={14} /> Upload Photos
                    <input type="file" accept="image/*" multiple onChange={handleActivityMultipleImageUpload} className="hidden" />
                  </label>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="accomplishedCheck"
                  checked={activityData.accomplished}
                  onChange={(e) => setActivityData({...activityData, accomplished: e.target.checked})}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="accomplishedCheck" className="text-xs font-semibold text-slate-700">Mark as Accomplished</label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowActivityModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow"
                >
                  {editingActivityId ? 'Save Changes' : 'Add Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
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
