import { useRouter } from 'next/router'
import ValidateGate from 'components/validate-gate'
import {
  Button, Flex, Grid, GridItem, Heading, Spinner, Icon, Box,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Radio,
  RadioGroup,
  HStack,
} from '@chakra-ui/react'
import { navHeight } from 'global-variables'
import { addScript, getLucid } from 'utils/lucid/lucid'
import { useSession } from 'next-auth/react'
import { RpsScript, validatorAddress, validatorRefUtxo, moves, moveToInt } from 'constants/games/rps/constants';
import { Lucid, UTxO, Data, PlutusData, Constr, utf8ToHex, TxHash, Address, hexToUtf8 } from 'lucid-cardano'
import { useEffect, useState, useCallback } from 'react'
import { addDatumMoveB, getGameMatchResult, getGameMatchResultIndex, getGameMoveDuration, getGamePolicyId, getGameSecondMoveIndex, getGameSecondMoveValue, getGameStake, getGameStartTime, getGameTokenName, getGameTxHash, getGameTxIx, getMove } from 'utils/games/rps/utils'
import { Move } from 'types/games/rps/types'
import { FaHandPaper, FaHandRock, FaHandScissors, FaQuestion } from 'react-icons/fa';
import { IconType } from 'react-icons'
import { Timer } from 'components/timer'
import { brandButtonStyle } from 'theme/simple'
import { getMintingPolicy } from 'utils/lucid/minting-policy'
import * as yup from "yup";
import { Field, Form, Formik } from 'formik';

// When we reach this page, it is assumed that the currency symbol given is a valid NFT as the path to reach this page checks for that. And if somebody is crazy enough to play by mentioning url itself, then they harm themself.

// Hack to have bigint's play nice with JSON.stringify(), source: https://github.com/GoogleChromeLabs/jsbi/issues/30#issuecomment-953187833
// @ts-ignore
BigInt.prototype.toJSON = function() { return this.toString() }

const Game = () => {
  const [waiting, setWaiting] = useState<boolean>(true)
  const [completed, setCompleted] = useState<boolean>(false)  // better redirect to a new page so that timers etc are completely cleared. New page will also have options.
  const [invalid, setInvalid] = useState<boolean>(false)
  const { status } = useSession()
  const [utxo, setUtxo] = useState<UTxO | null>(null)
  const { data } = useSession()
  const router = useRouter()
  const query = router.query;
  const moveIconMap: Record<Move, IconType> = { "Rock": FaHandRock, "Paper": FaHandPaper, "Scissors": FaHandScissors }

  const gameCompleted = () => {
    router.push({
      pathname: '/games/rps',
      query: {
        completed: "true",
      }
    })
  }

  const getDesiredGameUtxo = useCallback(async () => {
    const lucid: Lucid = await getLucid(data!.user.wallet)
    const utxos: UTxO[] = await lucid.utxosAt(validatorAddress)
    const queryPolicyId: string = query.policyId as string;
    for (let i = 0; i < utxos.length; i++) {
      // datum not present
      if (!(utxos[i].datum)) {
        continue;
      }
      // we want only two assets, lovelace & nft
      if (Object.keys(utxos[i].assets).length !== 2) {
        continue;
      }
      // nft amount is different than 1 (or not present)
      if (utxos[i].assets[queryPolicyId + utf8ToHex("RPS")] !== 1n) {
        continue;
      }
      return utxos[i]
    }
    return null
  }, [data, query])

  useEffect(() => {
    const interval = setInterval(async () => {
      console.log('running timer instance')
      if (completed) {
        clearInterval(interval)
      } else {
        if (status === 'authenticated') {
          const _utxo = await getDesiredGameUtxo()
          if (_utxo) {
            if (!utxo || (JSON.stringify(utxo) !== JSON.stringify(_utxo))) {  // their is no utxo yet or we have an updated one
              setUtxo(_utxo)
              setWaiting(false)
            }
          }
        }

      }
    }, 25 * 1000)
    return () => clearInterval(interval)
  }, [status, utxo, getDesiredGameUtxo, completed])

  // Once a move has been made, we wait for a new UTxO.
  const Waiting = () => (
    <Flex direction='column' justify='center' h={`calc(100vh - ${navHeight})`} align='center'>
      <Spinner size='xl' />
      <Heading variant='brand' textAlign='center' mt='30px' w='400px'>
        Waiting, it will take some time till the move is reflected on blockchain.
      </Heading>
    </Flex>
  )

  const MoveComponent = (icon: IconType | null, other: boolean) => {
    return (
      <Flex direction='column' justify='flex-end' align='center' h='full'>
        {icon ? <Icon as={icon} h='50%' w='50%' /> : <Flex w='50%' h='50%' align='center' justify='center'><Spinner /></Flex>
        }
        <Heading variant='brand' mt='30px'>
          {other ? "Other players move" : "Your move"}
        </Heading>
      </Flex>
    )
  }
  // First player options.
  const PlayerA = () => {
    const [move, setMove] = useState<Move | null>(null)
    const [timerDone, setTimerDone] = useState<boolean>(false)

    useEffect(() => {
      getMove(data!.user.password, Data.from(utxo!.datum!))
        .then((move: Move) => setMove(move))
        .catch((e) => setInvalid(e))
    }, [])

    const getFundsBackA = async (deadline: number) => {

      const _utxo = await getDesiredGameUtxo()

      if (JSON.stringify(_utxo) !== JSON.stringify(utxo)) {

        setUtxo(_utxo)
        alert("Other player made a move in nick of time!")

      } else {
        const lucid: Lucid = await getLucid(data!.user.wallet)
        const datum: PlutusData = Data.from(utxo!.datum!)
        const policyId = getGamePolicyId(datum)
        const tokenName = getGameTokenName(datum)
        const unit = policyId + tokenName
        const mintingPolicy = getMintingPolicy(getGameTxHash(datum), Number(getGameTxIx(datum)), hexToUtf8(tokenName))
        const { paymentCredential } = lucid.utils.getAddressDetails(await lucid.wallet.address())
        const tx = await lucid
          .newTx()
          // .readFrom([ref!])
          .collectFrom([utxo!], Data.to(new Constr(2, [])))
          .attachSpendingValidator(RpsScript)
          .addSignerKey(paymentCredential!.hash)
          .validFrom(deadline + 1000)  // adding 1 second, though with 1 milisecond it should work but somehow doesnt... got best at 0.2 second which also felt as unreliable.
          .mintAssets({ [unit]: -1n }, Data.to(new Constr(1, [])))
          .attachMintingPolicy(mintingPolicy)
          .complete()
        const signedTx = await tx.sign().complete()
        try {
          await signedTx.submit()  // maybe some use can be made for txhash.
          setCompleted(true)
        } catch (e) {
          alert("Their was an error, kindly retry. Error could have been caused by system clock not being accurate enough")
          console.log(e)
        }
      }
    }

    // Need to see current datum
    // Their are only two cases of interest
    // When second player has not made a move, datum says the move to be Nothing
    // When second player has made a move, datum giving move.
    try {
      const datum = Data.from(utxo!.datum!);
      if (getGameSecondMoveIndex(datum) === 1) {  // we are in nothing case
        const startTime = getGameStartTime(datum)
        const duration = getGameMoveDuration(datum)
        const deadline = Number(startTime + duration)
        return (
          <Grid
            templateAreas={`"moveA moveB"
                            "choice choice"`}
            gridTemplateColumns={'1fr 1fr'}
            gridTemplateRows={'3fr 1fr'}
            h={`calc(100vh - ${navHeight})`}
          >
            <GridItem area={'moveA'} >
              {MoveComponent(move ? moveIconMap[move] : null, false)}
            </GridItem>
            <GridItem area={'moveB'}>
              <Flex direction='column' justify='flex-end' align='center' h='full'>
                <Heading variant='brand' mb='25px'>Time remaining</Heading>
                {Timer(deadline, setTimerDone)}
                {
                  timerDone
                    ? <Heading variant='brand' textAlign='center' mt='25px'>
                      Second player timed out
                    </Heading>
                    :
                    <Heading variant='brand' textAlign='center' mt='25px'>
                      Waiting for second player to make move
                    </Heading>
                }
              </Flex>
            </GridItem>
            <GridItem area='choice'>
            {
              timerDone && (
                <Flex justify='center' h='full' align='center'>
                  <Button {...brandButtonStyle} onClick={() => getFundsBackA(deadline)}>
                    Get your funds back
                  </Button>

                </Flex>
              )
            }
            </GridItem>
          </Grid>
        )
      } else {  // second player has made a move
        return (
          <Heading>
            yet to implement
          </Heading>
        )

      }


    } catch {
      setInvalid(true)
      return null
    }
  }

  // Second player options.
  const PlayerB = () => {

    const [timerDone, setTimerDone] = useState<boolean>(false)
    const radioSchema = yup.object().shape({
      move: yup.string().required("Please enter your move").oneOf(moves)
    })

    const reset = () => {
      setTimerDone(false)
      setWaiting(true)
    }

    const makeMoveB = async (move: Move) => {

      const fromTime = Date.now()
      const lucid: Lucid = await getLucid(data!.user.wallet)
      const datum: PlutusData = Data.from(utxo!.datum!)
      const policyId = getGamePolicyId(datum)
      const tokenName = getGameTokenName(datum)
      const unit = policyId + tokenName
      const { paymentCredential } = lucid.utils.getAddressDetails(await lucid.wallet.address())
      // following check is not required as it is assumed but still doing
      if (utxo!.assets['lovelace'] !== getGameStake(datum)) throw "Stake amount doesn't match with that in datum"
      const startTime = getGameStartTime(datum)
      const duration = getGameMoveDuration(datum)
      const deadline = Number(startTime + duration)
      const tx = await lucid
        .newTx()
        // .readFrom([ref!])
        .collectFrom([utxo!], Data.to(new Constr(0, [new Constr(moveToInt[move], [])])))
        .attachSpendingValidator(RpsScript)
        .payToContract(validatorAddress, { inline: Data.to(addDatumMoveB(datum, move)) }, { lovelace: 2n * utxo!.assets['lovelace'], [unit]: 1n })
        .addSignerKey(paymentCredential!.hash)
        .validFrom(fromTime)
        .validTo(deadline)
        .complete()
      const signedTx = await tx.sign().complete()
      try {
        await signedTx.submit()  // maybe some use can be made for txhash.
        reset()
      } catch (e) {
        alert("Their was an error, kindly retry. Error could have been caused by system clock not being accurate enough. Error description: " + e)
      }
    }
    try {
      const datum = Data.from(utxo!.datum!);
      if (getGameSecondMoveIndex(datum) === 1) {  // We are waiting for second player to make a move
        const startTime = getGameStartTime(datum)
        const duration = getGameMoveDuration(datum)
        const deadline = Number(startTime + duration)
        return (
          <Grid
            templateAreas={`"moveA moveB"
                            "choice choice"`}
            gridTemplateColumns={'1fr 1fr'}
            gridTemplateRows={'3fr 1fr'}
            h={`calc(100vh - ${navHeight})`}
          >
            <GridItem area={'moveA'} >
              {MoveComponent(FaQuestion, true)}
            </GridItem>
            <GridItem area={'moveB'}>
              <Flex direction='column' justify='flex-end' align='center' h='full'>
                <Heading variant='brand' mb='25px'>Time remaining</Heading>
                {Timer(deadline, setTimerDone)}
              </Flex>
            </GridItem>
            <GridItem area='choice'>
              <Flex justify='center' h='full' align='center'>
              {
                timerDone
                ? 
                  <Heading variant='brand' textAlign='center'>
                  :( Timer is done
                  </Heading>
                :
                  <Formik
                    initialValues={{ move: '' }}
                    validationSchema={radioSchema}
                    onSubmit={async (values, actions) => {
                      await makeMoveB(values.move as Move)
                      actions.resetForm()
                    }}
                  >
                    {(props) => (
                      <Form>
                        <FormControl isInvalid={!!props.errors.move && props.touched.move} mt='10px' borderColor='black'>
                          <FormLabel textAlign='center' fontWeight='bold'>Enter your move</FormLabel>
                          <Field as={RadioGroup} name='move'>
                            <HStack spacing='15px' >
                              {moves.map((elem, ix) => (<Field as={Radio} key={ix} value={elem} borderColor='black' _checked={{ bg: 'black' }} >{elem}</Field>))}
                            </HStack>
                          </Field>
                          <FormErrorMessage>{props.errors.move}</FormErrorMessage>
                        </FormControl>
                        <Flex justify='center'>
                          <Button
                            mt={'10px'}
                            {...brandButtonStyle}
                            isLoading={props.isSubmitting}
                            type='submit'
                            mb={'10px'}
                          >
                            Submit
                          </Button>
                        </Flex>
                      </Form>
                    )}
                  </Formik>
              }
              </Flex>
            </GridItem>
          </Grid>
        )
      } else if (getGameMatchResultIndex(datum) === 1) {  // second player has made a move and match result is not determined, thus we are waiting for first player to make a move
        const aTimeoutTakeB = async (deadline: number) => {

          const _utxo = await getDesiredGameUtxo()

          if (JSON.stringify(_utxo) !== JSON.stringify(utxo)) {

            setUtxo(_utxo)
            alert("Other player made a move in nick of time!")

          } else {
            const lucid: Lucid = await getLucid(data!.user.wallet)
            const datum: PlutusData = Data.from(utxo!.datum!)
            const policyId = getGamePolicyId(datum)
            const tokenName = getGameTokenName(datum)
            const unit = policyId + tokenName
            const mintingPolicy = getMintingPolicy(getGameTxHash(datum), Number(getGameTxIx(datum)), hexToUtf8(tokenName))
            const { paymentCredential } = lucid.utils.getAddressDetails(await lucid.wallet.address())
            const tx = await lucid
              .newTx()
              // .readFrom([ref!])
              .collectFrom([utxo!], Data.to(new Constr(3, [])))
              .attachSpendingValidator(RpsScript)
              .addSignerKey(paymentCredential!.hash)
              .validFrom(deadline + 1000)
              .mintAssets({ [unit]: -1n }, Data.to(new Constr(1, [])))
              .attachMintingPolicy(mintingPolicy)
              .complete()
            const signedTx = await tx.sign().complete()
            try {
              await signedTx.submit()  // maybe some use can be made for txhash.
              setCompleted(true)
            } catch (e) {
              alert("Their was an error, kindly retry. Error could have been caused by system clock not being accurate enough")
              console.log(e)
            }
          }
        }

        const startTime = getGameStartTime(datum)
        const duration = getGameMoveDuration(datum)
        const deadline = Number(startTime + 2n * duration)
        return (
          <Grid
            templateAreas={`"moveA moveB"
                            "choice choice"`}
            gridTemplateColumns={'1fr 1fr'}
            gridTemplateRows={'3fr 1fr'}
            h={`calc(100vh - ${navHeight})`}
          >
            <GridItem area={'moveA'} >
              <Flex direction='column' justify='flex-end' align='center' h='full'>
                <Heading variant='brand' mb='25px'>Time remaining</Heading>
                {Timer(deadline, setTimerDone)}
                {
                  timerDone
                    ? <Heading variant='brand' textAlign='center' mt='25px'>
                      First player timed out, you won!
                    </Heading>
                    :
                    <Heading variant='brand' textAlign='center' mt='25px'>
                      Waiting for first player to make move
                    </Heading>
                }
              </Flex>
            </GridItem>
            <GridItem area={'moveB'}>
              {MoveComponent(moveIconMap[getGameSecondMoveValue(datum)], false)}
            </GridItem>
            <GridItem area='choice'>
            {
              timerDone && (
                <Flex justify='center' h='full' align='center'>
                  <Button {...brandButtonStyle} onClick={() => aTimeoutTakeB(deadline)}>
                    Take pool funds!
                  </Button>

                </Flex>
              )
            }
            </GridItem>
          </Grid>
        )
      } else {
        return null
      }
    } catch {
      setInvalid(true)
      return null
    }


  }

  return (
    <ValidateGate>
      {typeof (query?.policyId) !== "string" || typeof (query?.player) !== "string" || (query.player !== 'A' && query.player !== 'B')
        ? <Flex direction='column' justify='center' h={`calc(100vh - ${navHeight})`} align='center'>
          <Heading variant='brand'>
            Restricted.
          </Heading>
        </Flex>
        : invalid
          ? <Flex direction='column' justify='center' h={`calc(100vh - ${navHeight})`} align='center'>
            <Heading variant='brand'>
              You are playing an invalid game.
            </Heading>
          </Flex>
          : completed
            ? <Flex direction='column' justify='center' h={`calc(100vh - ${navHeight})`} align='center'>
              <Heading variant='brand'>
                Game is completed.
              </Heading>
            </Flex>
            : waiting
              ? <Waiting />
              : query.player === 'A' ? <PlayerA /> : <PlayerB />


      }
    </ValidateGate>
  )
}

export default Game