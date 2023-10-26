import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import datarequestabi from "../Datarequestabi.json"
import FetchIPFSData from "./FetchIPFSData";
import IPFSutils from "./IPFSutils";
import identityabi from "../Identityabi.json"
import { encrypt } from '@metamask/eth-sig-util';
import TransactionSpinner from "./TransactionSpinner";

function UserDashboard(props) {
    const [userRequests, setUserRequests] = useState([]);
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contractAddress = import.meta.env.VITE_DATA_REQUEST_CONTRACT;
    const identityContractAddress = import.meta.env.VITE_IDENTITY_CONTRACT;
    const identityContract = new ethers.Contract(identityContractAddress, identityabi, signer);
    const dataRequestContract = new ethers.Contract(contractAddress, datarequestabi, signer);
    const RequestStatus = ["Pending", "Approved", "Rejected"];
    const [isLoading, setIsLoading] = useState(false);
    let [loading, setLoading] = useState(false);
    const [noOfTransaction, setNoOfTransaction] = useState(0)

    useEffect(() => {
        async function fetchRequests() {
            setIsLoading(true);
            const userAddress = await signer.getAddress();
    
            // Fetch detailed request data instead of just IDs
            const requests = await dataRequestContract.getDetailedUserRequests(userAddress);
            
            const formattedRequests = requests.map(req => ({
                request: req, 
                status: RequestStatus[req.status]  // Use the status directly from the struct
            }));
            
            setUserRequests(formattedRequests);
            setIsLoading(false)
        }
    
        fetchRequests();
    }, []);
    
    async function handleApprove(request) {
        try {
            setLoading(true);
            setNoOfTransaction(3)
            const address = await signer.getAddress();
            const ipfsHash = await identityContract.getUserIPFSHash();
            const encryptedData = await FetchIPFSData(ipfsHash);
            const response = await identityContract.getUser(request.requester);
            const requesterPublicKey = await response[3];
            console.log(encryptedData)

            const accounts = await ethereum.request({
                method: 'eth_requestAccounts',
              });
              console.log(accounts[0])
            // Decrypt the user's data using eth_decrypt (assuming this is an encrypted JSON string)
            
            const decryptedData = await window.ethereum.request({
                method: 'eth_decrypt',
                params: [encryptedData, address],
            });
            setNoOfTransaction(2)
            const decryptedObject = JSON.parse(decryptedData)
            console.log(decryptedObject);
            
            
            // Get requester's public key
            // const requesterPublicKey = await window.ethereum.request({
            //     method: 'eth_getEncryptionPublicKey',
            //     params: [request.requester],  // Assuming request is in scope or you fetch it earlier in the function
            // });

            console.log("Public Key of Requester",requesterPublicKey);

          
            // Encrypt the data using requester's public key. This requires an encryption utility.
            // For this example, let's assume you have a utility function encryptWithPublicKey.
            const encryptedForRequester = await encryptJsonObject(requesterPublicKey, decryptedObject);
            console.log(encryptedForRequester)
            
            // Upload the encrypted data to IPFS
            const encryptedIpfsHash = await IPFSutils(encryptedForRequester);
            console.log("Encrypted Requester IPFS Hash:",encryptedIpfsHash.IpfsHash);
            // Store the encrypted IPFS hash on the Identity contract
            
            const tx = await identityContract.setRequesterIpfsHash(encryptedIpfsHash.IpfsHash);
            await tx.wait();
            
            setNoOfTransaction(1)
            // Finally, approve the request on the dataRequestContract
            
            const dataRequestTx = await dataRequestContract.approveRequest(request.id); 
            await dataRequestTx.wait();
            
            // Update the status in local state
            setUserRequests(prev => prev.map(req => 
                req.request.id === request.id ? { ...req, status: "Approved" } : req
            ));
            setLoading(false);
            props.showAlert("Request Approved✅","success")
        } catch (err) {
            setLoading(false);
            console.error("Error approving request:", err);
        }
    }
    
    
    
    async function handleReject(requestId) {
        try {
            setLoading(true);
            const tx = await dataRequestContract.rejectRequest(requestId);
            await tx.wait();
    
            // Update the status in local state
            setUserRequests(prev => prev.map(req => 
                req.request.id === requestId ? { ...req, status: "Rejected" } : req
            ));
            setLoading(false);
            props.showAlert("Request Rejected❌","danger")
        } catch (err) {
            setLoading(false);
            console.error("Error rejecting request:", err);
        }
    }
    
    async function encryptJsonObject(publicKey, jsonObject) {
        console.log('Public Key:', publicKey);
        const stringifiedObject = JSON.stringify(jsonObject);
        console.log(stringifiedObject);
        
        // Create an object to pass to the encrypt function
        const encryptionParams = {
            publicKey: publicKey,
            data: stringifiedObject,
            version: 'x25519-xsalsa20-poly1305',
        };
        
        // Encrypt the stringified JSON object using eth-sig-util
        const encryptedObject = encrypt(encryptionParams);
        
        return JSON.stringify(encryptedObject);  // Convert the encrypted object to a string
      }
    
    return (
        <>
        {isLoading ? (
                <div className="container">
                    <TransactionSpinner loading={isLoading}/> {/* Assuming TransactionSpinner is your loading component */}
                </div>
            ) :
    (    
        <>
        <h2>Dashboard</h2>
        <div>
            <ol>
                {userRequests.map(({ request, status }, index) => (
                    <li key={request.id}>
                        <div>
                            <p>Requester: {request.requester}</p>
                            <p>Fields: {request.fields.join(", ")}</p>
                            <p>Status: {status}</p>
                            {status === "Pending" && (
                                <>
                                    <button onClick={() => handleApprove(request)}>Approve</button>
                                    <button onClick={() => handleReject(request.id)}>Reject</button>
                                </>
                            )}
                        </div>
                    </li>
                ))}
            </ol>
            {loading && (<>
            <div className="container">
            <span><strong>Pending Transactions....{noOfTransaction}</strong></span>
            <TransactionSpinner loading={loading} />
            </div>
            </>)}
        </div>
        </> ) }
        </>
    );
    
    

    
}

export default UserDashboard;
