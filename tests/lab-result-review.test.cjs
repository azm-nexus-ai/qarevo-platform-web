const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), vm = require('node:vm')
const mod = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/lab-result-review.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,URLSearchParams,Date})
const helper=mod.exports, patient='11111111-1111-4111-8111-111111111111', order='22222222-2222-4222-8222-222222222222', file='33333333-3333-4333-8333-333333333333', review='44444444-4444-4444-8444-444444444444', provider='55555555-5555-4555-8555-555555555555'
const pending={state:'pending',file_id:file,review_id:null,reviewed_at:null,reviewer_provider_id:null,reviewer_name:null}
const ack={...pending,state:'acknowledged',review_id:review,reviewed_at:'2030-07-13T08:00:00Z',reviewer_provider_id:provider,reviewer_name:'Synthetic Clinician'}
test('pending requires explicit exact-file metadata; upload, order status and incomplete payloads never imply review',()=>{
  assert.equal(helper.labResultReview(pending,file).state,'pending')
  for(const input of [null,{}, {status:'Completed'}, {...pending,file_id:order},{state:'pending',file_id:file}, {...pending,state:'reviewed'}]) assert.equal(helper.labResultReview(input,file).state,'unavailable')
})
test('acknowledgements require consistent identities and UTC timestamps and cannot apply to a replacement file',()=>{
  assert.equal(helper.labResultReview(ack,file).reviewerName,'Synthetic Clinician')
  for(const input of [{...ack,review_id:null},{...ack,reviewed_at:'2030-07-13T08:00:00'},{...ack,reviewer_provider_id:'not-valid'},{...ack,reviewer_name:{} }]) assert.equal(helper.labResultReview(input,file).state,'unavailable')
  assert.equal(helper.labResultReview({...ack,reviewer_provider_id:null,reviewer_name:null},file).state,'acknowledged'); assert.equal(helper.labResultReview(ack,order).state,'unavailable'); assert.equal(helper.labResultReview({...ack,reviewer_name:null},file).state,'acknowledged')
})
test('lost-ack recovery receipts bind patient, order and file and preserve a superseded result without substitution',()=>{
  const value={id:review,patient_id:patient,lab_request_id:order,file_id:file,provider_id:provider,reviewed_at:ack.reviewed_at,replayed:true,current:false},target={patientId:patient,orderId:order,fileId:file,title:'Synthetic request'}
  assert.equal(helper.labReviewReceipt(value,target).current,false)
  for(const key of ['patient_id','lab_request_id','file_id']) assert.equal(helper.labReviewReceipt({...value,[key]:review},target),null)
  assert.equal(helper.labReviewReceipt(value,{...target,fileId:'invalid'}),null)
})
test('patient request links use one validated opaque reference and ignore arbitrary supplied destinations',()=>{
  assert.equal(helper.patientLabRequestHref(order),'/patient/lab-requests?requestId='+order)
  for(const value of ['https://foreign.test','../settings','id?medical=synthetic',null]) assert.equal(helper.patientLabRequestHref(value),undefined)
  assert.equal(helper.patientLabRequestTarget(new URLSearchParams('requestId='+order)).id,order)
  for(const query of ['requestId='+order+'&requestId='+file,'requestId=invalid','requestId=']) assert.equal(helper.patientLabRequestTarget(new URLSearchParams(query)).invalid,true)
  assert.equal(helper.patientLabRequestTarget(new URLSearchParams()).invalid,false)
})
